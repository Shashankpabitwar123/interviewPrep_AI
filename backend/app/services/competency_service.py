import re
from typing import Optional

from sqlalchemy.orm import Session

from app.models import CompetencyEvidence, Exam, MockInterview, MockMessage, PrepPlan, PrepTask, User
from app.schemas.role_intelligence import RoleBlueprint, RoleCompetency
from app.schemas.workspace import CompetencyProgress, LearningAction, LearningStateResponse


SOURCE_WEIGHTS = {
    "learning_task": 0.35,
    "exam_question": 1.0,
    "mock_answer": 1.15,
}
PRIORITY_WEIGHTS = {"critical": 3.0, "important": 2.0, "supporting": 1.0}


def record_task_evidence(db: Session, task: PrepTask, user: Optional[User]) -> None:
    plan = task.prep_plan
    blueprint = _role_blueprint(plan)
    names = _competencies_for_topics(task.topics or [task.title], blueprint)
    for name in names:
        if task.status == "complete":
            _upsert_evidence(
                db,
                user=user,
                plan=plan,
                competency_name=name,
                source_type="learning_task",
                source_id=str(task.id),
                score=0.65,
                weight=SOURCE_WEIGHTS["learning_task"],
                detail={"task_title": task.title, "topics": task.topics},
            )
        else:
            db.query(CompetencyEvidence).filter(
                CompetencyEvidence.job_post_id == plan.job_post_id,
                CompetencyEvidence.source_type == "learning_task",
                CompetencyEvidence.source_id == str(task.id),
                CompetencyEvidence.competency_key == competency_key(name),
            ).delete(synchronize_session=False)
    db.commit()


def record_exam_evidence(db: Session, exam: Exam, user: Optional[User]) -> None:
    plan = exam.prep_plan
    blueprint = _role_blueprint(plan)
    for question in exam.questions:
        latest = max(question.attempts, key=lambda item: item.id, default=None)
        if latest is None:
            continue
        metadata = question.question_metadata or {}
        competency_name = str(metadata.get("competency") or "").strip()
        if not competency_name:
            competency_name = _competencies_for_topics(question.topics or [], blueprint)[0]
        _upsert_evidence(
            db,
            user=user,
            plan=plan,
            competency_name=competency_name,
            source_type="exam_question",
            source_id=str(question.id),
            score=float(latest.score or 0),
            weight=SOURCE_WEIGHTS["exam_question"],
            detail={
                "exam_id": exam.id,
                "question_id": question.id,
                "difficulty": metadata.get("difficulty"),
                "cognitive_level": metadata.get("cognitive_level"),
                "topics": question.topics,
            },
        )
    db.commit()


def record_mock_evidence(
    db: Session,
    interview: MockInterview,
    feedback_message: MockMessage,
    competency_name: str,
    score: float,
    detail: dict,
    user: Optional[User],
) -> None:
    db.flush()
    _upsert_evidence(
        db,
        user=user,
        plan=interview.prep_plan,
        competency_name=competency_name,
        source_type="mock_answer",
        source_id=str(feedback_message.id),
        score=score,
        weight=SOURCE_WEIGHTS["mock_answer"],
        detail={
            "mock_interview_id": interview.id,
            "dimensions": detail.get("dimensions") or {},
            "strengths": detail.get("strengths") or [],
            "improvements": detail.get("improvements") or [],
        },
    )


def build_learning_state(db: Session, plan: PrepPlan, user: Optional[User]) -> LearningStateResponse:
    blueprint = _role_blueprint(plan)
    competencies = list(blueprint.competencies) if blueprint else _fallback_competencies(plan)
    _backfill_existing_evidence(db, plan, user, blueprint)
    evidence = db.query(CompetencyEvidence).filter(CompetencyEvidence.job_post_id == plan.job_post_id).all()
    by_key: dict[str, list[CompetencyEvidence]] = {}
    for item in evidence:
        by_key.setdefault(item.competency_key, []).append(item)

    progress: list[CompetencyProgress] = []
    for competency in competencies:
        key = competency_key(competency.name)
        signals = by_key.get(key, [])
        total_weight = sum(max(0.0, float(item.weight)) for item in signals)
        raw_score = (
            sum(float(item.score) * max(0.0, float(item.weight)) for item in signals) / total_weight
            if total_weight else 0.0
        )
        confidence = min(1.0, total_weight / 2.5)
        adjusted_score = round(raw_score * (0.55 + 0.45 * confidence) * 100) if signals else 0
        latest = max((item.updated_at for item in signals if item.updated_at), default=None)
        progress.append(CompetencyProgress(
            key=key,
            name=competency.name,
            category=competency.category,
            priority=competency.priority,
            score=max(0, min(100, adjusted_score)),
            confidence=round(confidence, 2),
            evidence_count=len(signals),
            source_types=sorted({item.source_type for item in signals}),
            last_practiced_at=latest,
            why_it_matters=competency.why_it_matters,
            next_action=_competency_next_action(competency, adjusted_score, confidence),
        ))

    progress.sort(key=lambda item: (_learning_need_rank(item.priority, item.score), item.name.casefold()))
    total_priority = sum(PRIORITY_WEIGHTS.get(item.priority, 1.0) for item in progress)
    overall = round(
        sum(item.score * PRIORITY_WEIGHTS.get(item.priority, 1.0) for item in progress) / total_priority
    ) if total_priority else 0
    strengths = [item.name for item in sorted(progress, key=lambda item: item.score, reverse=True) if item.score >= 70 and item.confidence >= 0.5][:4]
    focus = [item.name for item in progress if item.score < 70][:4]
    next_actions = [_learning_action(item) for item in progress[:3]]
    return LearningStateResponse(
        prep_plan_id=plan.id,
        job_post_id=plan.job_post_id,
        overall_mastery=overall,
        evidence_count=len(evidence),
        competencies=progress,
        strengths=strengths,
        focus_areas=focus,
        next_actions=next_actions,
    )


def prioritized_topics(db: Session, plan: PrepPlan, topics: list[str], user: Optional[User]) -> list[str]:
    state = build_learning_state(db, plan, user)
    rank = {item.key: index for index, item in enumerate(state.competencies)}
    unique_topics = list(dict.fromkeys(topic.strip() for topic in topics if topic.strip()))
    original_rank = {topic: index for index, topic in enumerate(unique_topics)}
    return sorted(
        unique_topics,
        key=lambda topic: (rank.get(_matching_competency_key(topic, state.competencies), len(rank)), original_rank[topic]),
    )


def learning_state_context(db: Session, plan: PrepPlan, user: Optional[User]) -> str:
    state = build_learning_state(db, plan, user)
    if not state.competencies:
        return "No competency evidence exists yet. Teach the requested topics and create a useful first baseline."
    lines = [
        f"- {item.name}: mastery={item.score}%, confidence={round(item.confidence * 100)}%, evidence={item.evidence_count}; next={item.next_action}"
        for item in state.competencies[:8]
    ]
    return "Current job-specific learning state (use only to prioritize, never to change scope):\n" + "\n".join(lines)


def competency_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", (value or "").casefold()).strip("-") or "role-fundamentals"


def _upsert_evidence(
    db: Session,
    *,
    user: Optional[User],
    plan: PrepPlan,
    competency_name: str,
    source_type: str,
    source_id: str,
    score: float,
    weight: float,
    detail: dict,
) -> CompetencyEvidence:
    key = competency_key(competency_name)
    item = db.query(CompetencyEvidence).filter(
        CompetencyEvidence.job_post_id == plan.job_post_id,
        CompetencyEvidence.source_type == source_type,
        CompetencyEvidence.source_id == source_id,
        CompetencyEvidence.competency_key == key,
    ).first()
    if item is None:
        item = CompetencyEvidence(
            user_id=user.id if user else None,
            job_post_id=plan.job_post_id,
            prep_plan_id=plan.id,
            competency_key=key,
            competency_name=competency_name,
            source_type=source_type,
            source_id=source_id,
        )
        db.add(item)
    item.score = max(0.0, min(1.0, float(score)))
    item.weight = max(0.0, float(weight))
    item.detail = detail
    return item


def _backfill_existing_evidence(
    db: Session,
    plan: PrepPlan,
    user: Optional[User],
    blueprint: Optional[RoleBlueprint],
) -> None:
    """Preserve learning history created before competency evidence existed."""

    existing = {
        (item.source_type, item.source_id, item.competency_key)
        for item in db.query(CompetencyEvidence).filter(CompetencyEvidence.job_post_id == plan.job_post_id).all()
    }
    added = False
    for task in plan.tasks:
        if task.status != "complete":
            continue
        for name in _competencies_for_topics(task.topics or [task.title], blueprint):
            marker = ("learning_task", str(task.id), competency_key(name))
            if marker in existing:
                continue
            _upsert_evidence(
                db,
                user=user,
                plan=plan,
                competency_name=name,
                source_type="learning_task",
                source_id=str(task.id),
                score=0.65,
                weight=SOURCE_WEIGHTS["learning_task"],
                detail={"task_title": task.title, "topics": task.topics, "backfilled": True},
            )
            existing.add(marker)
            added = True
    for exam in plan.exams:
        for question in exam.questions:
            latest = max(question.attempts, key=lambda item: item.id, default=None)
            if latest is None:
                continue
            metadata = question.question_metadata or {}
            name = str(metadata.get("competency") or "").strip() or _competencies_for_topics(question.topics or [], blueprint)[0]
            marker = ("exam_question", str(question.id), competency_key(name))
            if marker in existing:
                continue
            _upsert_evidence(
                db,
                user=user,
                plan=plan,
                competency_name=name,
                source_type="exam_question",
                source_id=str(question.id),
                score=float(latest.score or 0),
                weight=SOURCE_WEIGHTS["exam_question"],
                detail={"exam_id": exam.id, "question_id": question.id, "topics": question.topics, "backfilled": True},
            )
            existing.add(marker)
            added = True
    for interview in plan.mock_interviews:
        feedback_messages = [message for message in sorted(interview.messages, key=lambda item: item.id) if message.role == "feedback"]
        for index, message in enumerate(feedback_messages):
            detail = message.detail or {}
            slot = (interview.session_plan or [])[index] if index < len(interview.session_plan or []) else {}
            name = str(detail.get("competency") or slot.get("competency") or interview.current_topic)
            marker = ("mock_answer", str(message.id), competency_key(name))
            if marker in existing:
                continue
            _upsert_evidence(
                db,
                user=user,
                plan=plan,
                competency_name=name,
                source_type="mock_answer",
                source_id=str(message.id),
                score=float(message.score or 0),
                weight=SOURCE_WEIGHTS["mock_answer"],
                detail={**detail, "mock_interview_id": interview.id, "backfilled": True},
            )
            existing.add(marker)
            added = True
    if added:
        db.commit()


def _role_blueprint(plan: PrepPlan) -> Optional[RoleBlueprint]:
    record = plan.job_post.role_blueprint
    if record is None:
        return None
    try:
        return RoleBlueprint.model_validate(record.blueprint)
    except Exception:
        return None


def _fallback_competencies(plan: PrepPlan) -> list[RoleCompetency]:
    topics = list(dict.fromkeys(topic for task in plan.tasks for topic in (task.topics or []) if topic))[:12]
    return [RoleCompetency(
        name=topic,
        category="other",
        priority="important",
        why_it_matters="This topic is scheduled in the saved preparation plan.",
    ) for topic in topics]


def _competencies_for_topics(topics: list[str], blueprint: Optional[RoleBlueprint]) -> list[str]:
    if not blueprint or not blueprint.competencies:
        return list(dict.fromkeys(topic.strip() for topic in topics if topic.strip())) or ["Role fundamentals"]
    names: list[str] = []
    for topic in topics:
        topic_key = competency_key(topic)
        match = next((item.name for item in blueprint.competencies if _keys_overlap(topic_key, competency_key(item.name))), None)
        if match and match not in names:
            names.append(match)
    return names or [blueprint.competencies[0].name]


def _matching_competency_key(topic: str, competencies: list[CompetencyProgress]) -> str:
    topic_key = competency_key(topic)
    match = next((item.key for item in competencies if _keys_overlap(topic_key, item.key)), None)
    return match or topic_key


def _keys_overlap(first: str, second: str) -> bool:
    return first == second or first in second or second in first


def _learning_need_rank(priority: str, score: int) -> int:
    priority_bonus = {"critical": 25, "important": 10, "supporting": 0}.get(priority, 0)
    return score - priority_bonus


def _competency_next_action(competency: RoleCompetency, score: int, confidence: float) -> str:
    if confidence < 0.35:
        return f"Study {competency.name}, then take a focused baseline exam."
    if score < 60:
        mistake = competency.common_mistakes[0] if competency.common_mistakes else "Review the last weak answer and retry with a concrete example."
        return mistake
    if score < 80:
        return f"Practice one applied {competency.name} scenario and explain the tradeoffs aloud."
    return f"Confirm {competency.name} with one hard scenario or mock-interview follow-up."


def _learning_action(item: CompetencyProgress) -> LearningAction:
    if item.confidence < 0.35:
        action_type = "study_then_exam"
        title = f"Build a baseline for {item.name}"
    elif item.score < 60:
        action_type = "review_and_retry"
        title = f"Repair the gap in {item.name}"
    else:
        action_type = "scenario_practice"
        title = f"Apply {item.name} under interview pressure"
    return LearningAction(
        competency_key=item.key,
        competency_name=item.name,
        action_type=action_type,
        title=title,
        detail=item.next_action,
    )
