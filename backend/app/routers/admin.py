from datetime import datetime, time, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Exam, JobPost, MockInterview, PrepPlan, User, UserUsageEvent
from app.schemas.admin import AdminBlockRequest, AdminOverview, AdminUsageEventResponse, AdminUserDetail, AdminUserSummary
from app.services.auth_service import delete_user_account, require_admin_user
from app.services.usage_service import record_usage_event

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/overview", response_model=AdminOverview)
def get_admin_overview(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin_user),
) -> AdminOverview:
    users = _build_user_summaries(db)
    today_start = datetime.combine(datetime.now(timezone.utc).date(), time.min, tzinfo=timezone.utc)
    recent_events = db.query(UserUsageEvent).order_by(UserUsageEvent.created_at.desc()).limit(30).all()
    return AdminOverview(
        total_users=len(users),
        active_users=sum(1 for user in users if user.status == "active"),
        blocked_users=sum(1 for user in users if user.status == "blocked"),
        admin_users=sum(1 for user in users if user.role == "admin"),
        accounts_created_today=db.query(User).filter(User.created_at >= today_start).count(),
        logins_today=db.query(UserUsageEvent).filter(
            UserUsageEvent.event_type == "login",
            UserUsageEvent.created_at >= today_start,
        ).count(),
        total_api_tokens=sum(user.total_tokens for user in users),
        total_events=db.query(UserUsageEvent).count(),
        recent_events=[AdminUsageEventResponse.model_validate(event) for event in recent_events],
        users=users,
    )


@router.get("/users", response_model=list[AdminUserSummary])
def list_admin_users(
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin_user),
) -> list[AdminUserSummary]:
    return _build_user_summaries(db)


@router.get("/users/{user_id}", response_model=AdminUserDetail)
def get_admin_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin_user),
) -> AdminUserDetail:
    users = {user.id: user for user in _build_user_summaries(db)}
    user = users.get(user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    events = db.query(UserUsageEvent).filter(UserUsageEvent.user_id == user_id).order_by(UserUsageEvent.created_at.desc()).limit(50).all()
    return AdminUserDetail(user=user, recent_events=[AdminUsageEventResponse.model_validate(event) for event in events])


@router.post("/users/{user_id}/block", response_model=AdminUserSummary)
def block_user(
    user_id: int,
    request: AdminBlockRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin_user),
) -> AdminUserSummary:
    target = _get_target_user(db, user_id, admin)
    target.status = "blocked"
    target.blocked_at = datetime.now(timezone.utc)
    target.block_reason = request.reason.strip() or "Blocked by developer review."
    db.commit()
    record_usage_event(
        db,
        admin,
        "user_blocked",
        "developer_dashboard",
        provider="system",
        detail={"target_user_id": target.id, "target_email": target.email, "reason": target.block_reason},
    )
    return _build_user_summaries(db, target_user_id=target.id)[0]


@router.post("/users/{user_id}/unblock", response_model=AdminUserSummary)
def unblock_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin_user),
) -> AdminUserSummary:
    target = _get_target_user(db, user_id, admin)
    target.status = "active"
    target.blocked_at = None
    target.block_reason = None
    db.commit()
    record_usage_event(
        db,
        admin,
        "user_unblocked",
        "developer_dashboard",
        provider="system",
        detail={"target_user_id": target.id, "target_email": target.email},
    )
    return _build_user_summaries(db, target_user_id=target.id)[0]


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_admin_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin_user),
) -> None:
    target = _get_target_user(db, user_id, admin)
    target_email = target.email
    record_usage_event(
        db,
        admin,
        "user_deleted",
        "developer_dashboard",
        provider="system",
        detail={"target_user_id": target.id, "target_email": target_email},
    )
    delete_user_account(db, target)


def _get_target_user(db: Session, user_id: int, admin: User) -> User:
    target = db.get(User, user_id)
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    if target.id == admin.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot manage your own admin account here.")
    return target


def _build_user_summaries(db: Session, target_user_id: int | None = None) -> list[AdminUserSummary]:
    users_query = db.query(User)
    if target_user_id is not None:
        users_query = users_query.filter(User.id == target_user_id)
    users = users_query.order_by(User.created_at.desc()).all()
    user_ids = [user.id for user in users]
    usage_counts = _aggregate_by_user(db, UserUsageEvent.user_id, func.count(UserUsageEvent.id), UserUsageEvent.user_id.in_(user_ids))
    token_counts = _aggregate_by_user(db, UserUsageEvent.user_id, func.coalesce(func.sum(UserUsageEvent.total_tokens), 0), UserUsageEvent.user_id.in_(user_ids))
    job_counts = _aggregate_by_user(db, JobPost.user_id, func.count(JobPost.id), JobPost.user_id.in_(user_ids))
    plan_counts = _aggregate_joined_plans(db, user_ids)
    exam_counts = _aggregate_joined_exams(db, user_ids)
    mock_counts = _aggregate_joined_mocks(db, user_ids)
    note_counts = _aggregate_by_user(
        db,
        UserUsageEvent.user_id,
        func.count(UserUsageEvent.id),
        UserUsageEvent.user_id.in_(user_ids),
        UserUsageEvent.feature == "study_notes",
    )
    return [
        AdminUserSummary(
            id=user.id,
            name=user.name,
            email=user.email,
            role=user.role,
            status=user.status,
            created_at=user.created_at,
            last_login_at=user.last_login_at,
            last_seen_at=user.last_seen_at,
            blocked_at=user.blocked_at,
            block_reason=user.block_reason,
            total_tokens=int(token_counts.get(user.id, 0) or 0),
            total_events=int(usage_counts.get(user.id, 0) or 0),
            jobs_count=int(job_counts.get(user.id, 0) or 0),
            prep_plans_count=int(plan_counts.get(user.id, 0) or 0),
            exams_count=int(exam_counts.get(user.id, 0) or 0),
            mock_interviews_count=int(mock_counts.get(user.id, 0) or 0),
            notes_events_count=int(note_counts.get(user.id, 0) or 0),
        )
        for user in users
    ]


def _aggregate_by_user(db: Session, user_column, aggregate_column, *filters) -> dict[int, int]:
    rows = db.query(user_column, aggregate_column).filter(*filters).group_by(user_column).all()
    return {int(user_id): int(value or 0) for user_id, value in rows if user_id is not None}


def _aggregate_joined_plans(db: Session, user_ids: list[int]) -> dict[int, int]:
    rows = db.query(JobPost.user_id, func.count(PrepPlan.id)).join(PrepPlan, PrepPlan.job_post_id == JobPost.id).filter(JobPost.user_id.in_(user_ids)).group_by(JobPost.user_id).all()
    return {int(user_id): int(count or 0) for user_id, count in rows if user_id is not None}


def _aggregate_joined_exams(db: Session, user_ids: list[int]) -> dict[int, int]:
    rows = db.query(JobPost.user_id, func.count(Exam.id)).join(PrepPlan, PrepPlan.job_post_id == JobPost.id).join(Exam, Exam.prep_plan_id == PrepPlan.id).filter(JobPost.user_id.in_(user_ids)).group_by(JobPost.user_id).all()
    return {int(user_id): int(count or 0) for user_id, count in rows if user_id is not None}


def _aggregate_joined_mocks(db: Session, user_ids: list[int]) -> dict[int, int]:
    rows = db.query(JobPost.user_id, func.count(MockInterview.id)).join(PrepPlan, PrepPlan.job_post_id == JobPost.id).join(MockInterview, MockInterview.prep_plan_id == PrepPlan.id).filter(JobPost.user_id.in_(user_ids)).group_by(JobPost.user_id).all()
    return {int(user_id): int(count or 0) for user_id, count in rows if user_id is not None}
