from datetime import datetime, timedelta, timezone
from collections.abc import Generator

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool
from openai.lib._pydantic import to_strict_json_schema

from app.config import Settings, get_settings
from app.database import Base, get_db
from app.main import app
from app.models import ArtifactFeedback, CompetencyEvidence, Exam, GenerationRun, User
from app.schemas.study_note import NoteSection, StudyNoteResponse, StudyResource
from app.services.mock_interview_service import MockVoiceAnswerEvaluation, MockVoiceEvaluationOutput, _is_voice_command
from app.services.study_note_service import AIStudyNoteOutput


def test_job_analysis_endpoint_saves_and_reads_job() -> None:
    client = _client_with_memory_db()

    response = client.post(
        "/jobs/analyze",
        json={
            "job_title": "Backend Software Engineer Intern",
            "job_description": "Build Python FastAPI REST APIs with SQL, Docker, testing, and teamwork.",
        },
    )

    body = response.json()
    assert response.status_code == 200
    assert body["job_post_id"] is not None
    assert body["analysis_id"] is not None

    detail = client.get(f"/jobs/{body['job_post_id']}").json()
    assert detail["title"] == "Backend Software Engineer Intern"
    assert detail["analysis"]["source"] in {"heuristic", "heuristic_fallback"}

    # The fixed v2 analysis is created and persisted during this same upload.
    # Reading the Jobs tab contract later should only return the saved result.
    brief_response = client.get(f"/jobs/{body['job_post_id']}/brief")
    brief = brief_response.json()
    assert brief_response.status_code == 200
    assert brief["analysis_version"] == "v2"
    assert brief["role_title"] == "Backend Software Engineer Intern"
    assert brief["role_summary"]
    assert brief["requirements"]["must_have"]
    assert brief["interview_topics"]

    second_read = client.get(f"/jobs/{body['job_post_id']}/brief")
    assert second_read.status_code == 200
    assert second_read.json() == brief

    intelligence_response = client.get(f"/jobs/{body['job_post_id']}/intelligence")
    intelligence = intelligence_response.json()
    assert intelligence_response.status_code == 200
    assert intelligence["blueprint"]["version"] == "v3"
    assert intelligence["blueprint"]["source_fingerprint"]
    assert intelligence["blueprint"]["competencies"]
    assert intelligence["blueprint"]["research_sources"][0]["origin"] == "job_posting"


def test_logged_in_users_only_see_their_own_jobs() -> None:
    client = _client_with_memory_db()
    first = _register(client, {"name": "First User", "email": "first@example.com", "password": "Password1!"}).json()["access_token"]
    second = _register(client, {"name": "Second User", "email": "second@example.com", "password": "Password1!"}).json()["access_token"]

    client.post(
        "/jobs/analyze",
        headers={"Authorization": f"Bearer {first}"},
        json={
            "job_title": "Backend Software Engineer Intern",
            "job_description": "Build Python FastAPI REST APIs with SQL, Docker, testing, and teamwork.",
        },
    )
    client.post(
        "/jobs/analyze",
        headers={"Authorization": f"Bearer {second}"},
        json={
            "job_title": "Sales Intern",
            "job_description": "Work with clients, campaigns, communication, and performance-based goals.",
        },
    )

    first_jobs = client.get("/jobs", headers={"Authorization": f"Bearer {first}"}).json()
    second_jobs = client.get("/jobs", headers={"Authorization": f"Bearer {second}"}).json()

    assert [job["title"] for job in first_jobs] == ["Backend Software Engineer Intern"]
    assert [job["title"] for job in second_jobs] == ["Sales Intern"]


def test_health_provider_status_never_returns_credentials() -> None:
    client = _client_with_memory_db()
    app.dependency_overrides[get_settings] = lambda: Settings(
        app_env="test",
        openai_api_key="secret-openai-value",
        tavily_api_key="secret-tavily-value",
        email_provider="resend",
        resend_api_key="secret-resend-value",
        email_from="PrepInterview AI <hello@example.com>",
    )

    response = client.get("/health/providers")
    body = response.json()

    assert response.status_code == 200
    assert body["providers"]["openai"]["configured"] is True
    assert body["providers"]["tavily"]["configured"] is True
    assert body["providers"]["resend"] == {"credential_configured": True, "sender_configured": True}
    assert body["providers"]["email"] == {"configured": True, "provider": "resend"}
    assert "secret" not in response.text


def test_job_analysis_endpoint_can_use_source_url(monkeypatch) -> None:
    client = _client_with_memory_db()

    def fake_fetch(source_url: str) -> str:
        return "Python FastAPI SQL REST API Docker testing backend internship role with teamwork."

    monkeypatch.setattr("app.services.job_source.fetch_job_description_from_url", fake_fetch)

    response = client.post(
        "/jobs/analyze",
        json={
            "job_title": "Backend Software Engineer Intern",
            "source_url": "https://example.com/jobs/backend-intern",
        },
    )

    body = response.json()
    assert response.status_code == 200
    assert "Python" in body["required_skills"]

    detail = client.get(f"/jobs/{body['job_post_id']}").json()
    assert detail["source_url"] == "https://example.com/jobs/backend-intern"


def test_job_analysis_endpoint_infers_title_when_user_leaves_it_blank() -> None:
    client = _client_with_memory_db()

    response = client.post(
        "/jobs/analyze",
        json={
            "job_title": "Auto-detect role",
            "job_description": "Role: Sales Intern. Work with clients, campaigns, communication, and performance-based goals.",
        },
    )

    body = response.json()
    assert response.status_code == 200
    assert body["role_title"] == "Sales Intern"

    detail = client.get(f"/jobs/{body['job_post_id']}").json()
    assert detail["title"] == "Sales Intern"


def test_saved_job_description_can_be_updated_by_its_owner() -> None:
    client = _client_with_memory_db()
    token = _register(client, {"name": "Editor", "email": "editor@example.com", "password": "Password1!"}).json()["access_token"]
    saved = client.post(
        "/jobs/analyze",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "job_title": "Backend Software Engineer",
            "job_description": "Build Python FastAPI REST APIs with SQL, testing, and collaborative engineering practices.",
        },
    ).json()

    updated_text = "Build reliable Python services with FastAPI, SQL, thoughtful tests, and close collaboration across the product team."
    response = client.patch(
        f"/jobs/{saved['job_post_id']}/description",
        headers={"Authorization": f"Bearer {token}"},
        json={"description": updated_text},
    )

    assert response.status_code == 200
    assert response.json()["description"] == updated_text
    assert client.get(f"/jobs/{saved['job_post_id']}", headers={"Authorization": f"Bearer {token}"}).json()["description"] == updated_text


def test_prep_plan_endpoint_saves_and_reads_plan() -> None:
    client = _client_with_memory_db()

    response = client.post(
        "/prep-plans",
        json={
            "job_title": "Backend Software Engineer",
            "job_description": "Python SQL REST APIs Docker testing and system design.",
            "interview_at": (datetime.now(timezone.utc) + timedelta(days=3)).isoformat(),
            "hours_per_day": 2,
            "comfort_level": "intermediate",
        },
    )

    body = response.json()
    assert response.status_code == 200
    assert body["prep_plan_id"] is not None
    assert all(task["id"] is not None for task in body["tasks"])

    detail = client.get(f"/prep-plans/{body['prep_plan_id']}").json()
    assert detail["job_title"] == "Backend Software Engineer"
    assert len(detail["tasks"]) == len(body["tasks"])
    assert detail["hours_per_day"] == 2
    assert detail["interview_at"] is not None
    assert body["quality_report"]["artifact_type"] == "prep_plan"
    assert isinstance(body["quality_report"]["score"], int)
    assert detail["quality_report"] == body["quality_report"]

    # A plan created directly (without a prior saved-job upload) also leaves a
    # canonical job analysis behind in the same creation request.
    brief_response = client.get(f"/jobs/{body['job_post_id']}/brief")
    assert brief_response.status_code == 200
    assert brief_response.json()["analysis_version"] == "v2"


def test_saved_job_metadata_and_existing_job_plan_stay_connected() -> None:
    client = _client_with_memory_db()
    interview_at = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()
    saved = client.post(
        "/jobs/analyze",
        json={
            "job_title": "Data Analyst",
            "company": "Example Bank",
            "job_description": "Analyze business data with SQL, Python, Tableau, dashboards, and stakeholder communication.",
            "interview_at": interview_at,
            "hours_per_day": 2.5,
        },
    ).json()

    job_id = saved["job_post_id"]
    detail = client.get(f"/jobs/{job_id}").json()
    assert detail["hours_per_day"] == 2.5
    assert detail["interview_at"] is not None

    plan_response = client.post(
        "/prep-plans",
        json={
            "job_post_id": job_id,
            "job_title": "Data Analyst",
            "company": "Example Bank",
            "interview_at": interview_at,
            "hours_per_day": 2.5,
        },
    )
    assert plan_response.status_code == 200
    assert plan_response.json()["job_post_id"] == job_id
    assert len(client.get("/jobs").json()) == 1


def test_workspace_sync_and_readiness_use_real_plan_state() -> None:
    client = _client_with_memory_db()
    plan = client.post(
        "/prep-plans",
        json={
            "job_title": "Backend Software Engineer",
            "job_description": "Python SQL REST APIs Docker testing and system design.",
            "interview_at": (datetime.now(timezone.utc) + timedelta(days=3)).isoformat(),
            "hours_per_day": 2,
            "comfort_level": "intermediate",
        },
    ).json()
    task_id = plan["tasks"][0]["id"]

    updated = client.patch(f"/prep-plans/tasks/{task_id}", json={"status": "complete"})
    assert updated.status_code == 200
    assert updated.json()["status"] == "complete"

    sync = client.put(
        "/workspace",
        json={
            "data": {
                "completedTasks": {f"2026-08-15:task:{task_id}": "2026-08-15"},
                "recentActivity": [{"createdAt": datetime.now(timezone.utc).isoformat(), "type": "study"}],
                "notes": [{"id": "note-1", "planId": plan["prep_plan_id"], "title": "Python"}],
            }
        },
    )
    assert sync.status_code == 200
    assert sync.json()["data"]["notes"][0]["title"] == "Python"
    revision = sync.json()["data"]["_revision"]
    current_write = client.put(
        "/workspace",
        json={"data": sync.json()["data"], "expected_revision": revision},
    )
    assert current_write.status_code == 200
    stale_write = client.put(
        "/workspace",
        json={"data": sync.json()["data"], "expected_revision": revision},
    )
    assert stale_write.status_code == 409

    readiness = client.get(f"/workspace/readiness?prep_plan_id={plan['prep_plan_id']}")
    assert readiness.status_code == 200
    report = readiness.json()
    assert report["formula"] == "25% plan + 15% learning + 25% role mastery + 20% exams + 10% mock interviews + 5% consistency"
    assert report["score"] > 0
    assert {component["key"] for component in report["components"]} == {"plan", "learning", "competencies", "exams", "mocks", "consistency"}


def test_readiness_ignores_other_plan_activity_and_archived_default_plan() -> None:
    client = _client_with_memory_db()
    first = client.post(
        "/prep-plans",
        json={
            "job_title": "Data Analyst",
            "job_description": "SQL Python dashboards and stakeholder communication.",
            "interview_at": (datetime.now(timezone.utc) + timedelta(days=5)).isoformat(),
            "hours_per_day": 2,
            "comfort_level": "intermediate",
        },
    ).json()
    second = client.post(
        "/prep-plans",
        json={
            "job_title": "Backend Engineer",
            "job_description": "Python APIs databases and distributed systems.",
            "interview_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
            "hours_per_day": 2,
            "comfort_level": "intermediate",
        },
    ).json()
    sync = client.put(
        "/workspace",
        json={
            "data": {
                "archivedJobIds": [str(second["job_post_id"])],
                "recentActivity": [{
                    "createdAt": datetime.now(timezone.utc).isoformat(),
                    "type": "study",
                    "prepPlanId": second["prep_plan_id"],
                    "jobPostId": second["job_post_id"],
                }],
            }
        },
    )
    assert sync.status_code == 200

    first_report = client.get(f"/workspace/readiness?prep_plan_id={first['prep_plan_id']}").json()
    consistency = next(item for item in first_report["components"] if item["key"] == "consistency")
    assert consistency["score"] == 0
    default_report = client.get("/workspace/readiness")
    assert default_report.status_code == 200
    assert default_report.json()["prep_plan_id"] == first["prep_plan_id"]


def test_exam_generation_and_submission_flow() -> None:
    client = _client_with_memory_db()
    plan_response = client.post(
        "/prep-plans",
        json={
            "job_title": "Backend Software Engineer",
            "job_description": "Python SQL REST APIs Docker testing and system design.",
            "interview_at": (datetime.now(timezone.utc) + timedelta(days=3)).isoformat(),
            "hours_per_day": 2,
            "comfort_level": "intermediate",
        },
    )
    prep_plan_id = plan_response.json()["prep_plan_id"]

    exam_response = client.post(
        "/exams/generate",
        json={"prep_plan_id": prep_plan_id, "day": 1, "question_count": 3, "difficulty": "medium"},
    )

    exam = exam_response.json()
    assert exam_response.status_code == 200
    assert len(exam["questions"]) == 3
    assert all("expected_answer" not in question for question in exam["questions"])
    assert all(
        "is_correct" not in option
        for question in exam["questions"]
        for option in (question.get("options") or [])
    )

    answers = []
    for question in exam["questions"]:
        answers.append(
            {
                "question_id": question["id"],
                "answer_text": "A" if question["question_type"] == "multiple_choice" else "I would explain with an example, tradeoff, tests, edge cases, and complexity.",
            }
        )

    submission = client.post(f"/exams/{exam['id']}/submit", json={"answers": answers})

    assert submission.status_code == 200
    assert submission.json()["average_score"] > 0.5
    review = submission.json()["review_exam"]
    assert all("expected_answer" in question for question in review["questions"])
    assert any(
        "is_correct" in option
        for question in review["questions"]
        for option in (question.get("options") or [])
    )
    stored = client.get(f"/exams?prep_plan_id={prep_plan_id}")
    assert stored.status_code == 200
    assert stored.json()[0]["exam"]["id"] == exam["id"]
    assert stored.json()[0]["status"] == "complete"
    assert stored.json()[0]["average_score"] == submission.json()["average_score"]
    assert len(stored.json()[0]["answers"]) == len(exam["questions"])

    learning_state = client.get(f"/workspace/learning-state?prep_plan_id={prep_plan_id}")
    assert learning_state.status_code == 200
    assert learning_state.json()["evidence_count"] == len(exam["questions"])
    assert any(item["source_types"] == ["exam_question"] for item in learning_state.json()["competencies"])
    assert client.delete(f"/exams/{exam['id']}").status_code == 204
    db = next(client.app.dependency_overrides[get_db]())
    assert db.query(CompetencyEvidence).filter(CompetencyEvidence.source_type == "exam_question").count() == 0


def test_learning_state_tracks_completed_tasks_and_reopens_them_cleanly() -> None:
    client = _client_with_memory_db()
    plan = client.post(
        "/prep-plans",
        json={
            "job_title": "Data Analyst",
            "job_description": "Analyze business data with SQL, Python, dashboards, accuracy, and stakeholder communication.",
            "interview_at": (datetime.now(timezone.utc) + timedelta(days=4)).isoformat(),
            "hours_per_day": 2,
            "comfort_level": "intermediate",
        },
    ).json()
    task_id = plan["tasks"][0]["id"]

    completed = client.patch(f"/prep-plans/tasks/{task_id}", json={"status": "complete"})
    assert completed.status_code == 200
    state = client.get(f"/workspace/learning-state?prep_plan_id={plan['prep_plan_id']}").json()
    assert state["evidence_count"] >= 1
    assert state["next_actions"]

    reopened = client.patch(f"/prep-plans/tasks/{task_id}", json={"status": "not_started"})
    assert reopened.status_code == 200
    db = next(client.app.dependency_overrides[get_db]())
    assert db.query(CompetencyEvidence).filter(
        CompetencyEvidence.source_type == "learning_task",
        CompetencyEvidence.source_id == str(task_id),
    ).count() == 0


def test_artifact_feedback_is_owned_and_updates_one_signal() -> None:
    client = _client_with_memory_db()
    plan = client.post(
        "/prep-plans",
        json={
            "job_title": "Data Analyst",
            "job_description": "Analyze business data with SQL, Python, dashboards, accuracy, and stakeholder communication.",
            "interview_at": (datetime.now(timezone.utc) + timedelta(days=4)).isoformat(),
            "hours_per_day": 2,
            "comfort_level": "intermediate",
        },
    ).json()
    payload = {
        "artifact_type": "study_note",
        "artifact_id": "day-1-sql-note",
        "prep_plan_id": plan["prep_plan_id"],
        "rating": "needs_work",
    }
    first = client.post("/feedback", json=payload)
    second = client.post("/feedback", json={**payload, "rating": "helpful"})

    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json()["rating"] == "helpful"
    db = next(client.app.dependency_overrides[get_db]())
    stored = db.query(ArtifactFeedback).filter(ArtifactFeedback.artifact_id == "day-1-sql-note").all()
    assert len(stored) == 1
    assert stored[0].rating == "helpful"

    missing = client.post("/feedback", json={**payload, "prep_plan_id": 999999})
    assert missing.status_code == 404


def test_admin_overview_reports_generation_quality_and_latency() -> None:
    client = _client_with_memory_db()
    registered = _register(
        client,
        {"name": "Quality Admin", "email": "quality-admin@example.com", "password": "Password1!"},
    ).json()
    db = next(client.app.dependency_overrides[get_db]())
    admin = db.query(User).filter_by(id=registered["user"]["id"]).one()
    admin.role = "admin"
    db.commit()

    plan = client.post(
        "/prep-plans",
        headers={"Authorization": f"Bearer {registered['access_token']}"},
        json={
            "job_title": "Data Analyst",
            "job_description": "Analyze business data with SQL, Python, dashboards, accuracy, and stakeholder communication.",
            "interview_at": (datetime.now(timezone.utc) + timedelta(days=4)).isoformat(),
            "hours_per_day": 2,
            "comfort_level": "intermediate",
        },
    )
    assert plan.status_code == 200

    overview = client.get(
        "/admin/overview",
        headers={"Authorization": f"Bearer {registered['access_token']}"},
    )
    assert overview.status_code == 200
    quality = overview.json()["generation_quality"]
    assert quality["total_runs"] >= 1
    assert quality["evaluated_runs"] >= 1
    assert quality["average_latency_ms"] >= 0
    assert any(item["artifact_type"] == "prep_plan" for item in quality["artifacts"])


def test_failed_generation_is_traced_without_saving_partial_exam() -> None:
    client = _client_with_memory_db()
    plan = client.post(
        "/prep-plans",
        headers={"X-Allow-Local-Fallback": "true"},
        json={
            "job_title": "Data Analyst",
            "job_description": "Analyze business data with SQL, Python, dashboards, accuracy, and stakeholder communication.",
            "interview_at": (datetime.now(timezone.utc) + timedelta(days=4)).isoformat(),
            "hours_per_day": 2,
            "comfort_level": "intermediate",
        },
    ).json()
    client.headers.update({"X-Allow-Local-Fallback": "false"})

    response = client.post(
        "/exams/generate",
        json={"prep_plan_id": plan["prep_plan_id"], "day": 1, "question_count": 3, "difficulty": "medium"},
    )
    assert response.status_code == 503
    db = next(client.app.dependency_overrides[get_db]())
    assert db.query(Exam).filter(Exam.prep_plan_id == plan["prep_plan_id"]).count() == 0
    failed = db.query(GenerationRun).filter(
        GenerationRun.artifact_type == "exam",
        GenerationRun.status == "failed",
    ).one()
    assert failed.detail["stage"] == "exam_generation"


def test_exam_submission_counts_unanswered_questions_as_zero() -> None:
    client = _client_with_memory_db()
    plan_response = client.post(
        "/prep-plans",
        json={
            "job_title": "Backend Software Engineer",
            "job_description": "Python SQL REST APIs Docker testing and system design.",
            "interview_at": (datetime.now(timezone.utc) + timedelta(days=3)).isoformat(),
            "hours_per_day": 2,
            "comfort_level": "intermediate",
        },
    )
    prep_plan_id = plan_response.json()["prep_plan_id"]

    exam_response = client.post(
        "/exams/generate",
        json={"prep_plan_id": prep_plan_id, "day": 1, "question_count": 4, "difficulty": "medium"},
    )
    exam = exam_response.json()
    first_question = exam["questions"][0]

    answer_text = (
        "A"
        if first_question["question_type"] in {"multiple_choice", "multiple_select"}
        else "I would explain with a concrete example, tradeoff, edge case, and validation step."
    )
    submission = client.post(
        f"/exams/{exam['id']}/submit",
        json={"answers": [{"question_id": first_question["id"], "answer_text": answer_text}]},
    )
    body = submission.json()

    assert submission.status_code == 200
    assert len(body["results"]) == len(exam["questions"])
    assert body["average_score"] < 1
    assert any(result["score"] == 0 and result["feedback"].startswith("Not answered") for result in body["results"])


def test_exam_delete_removes_backend_attempt_and_respects_ownership() -> None:
    client = _client_with_memory_db()
    first = _register(client, {"name": "First User", "email": "exam-delete-first@example.com", "password": "Password1!"}).json()["access_token"]
    second = _register(client, {"name": "Second User", "email": "exam-delete-second@example.com", "password": "Password1!"}).json()["access_token"]
    plan = client.post(
        "/prep-plans",
        headers={"Authorization": f"Bearer {first}"},
        json={
            "job_title": "Backend Software Engineer",
            "job_description": "Python SQL REST APIs Docker testing and system design.",
            "interview_at": (datetime.now(timezone.utc) + timedelta(days=3)).isoformat(),
            "hours_per_day": 2,
        },
    ).json()
    exam = client.post(
        "/exams/generate",
        headers={"Authorization": f"Bearer {first}"},
        json={"prep_plan_id": plan["prep_plan_id"], "day": 1, "question_count": 3, "difficulty": "medium"},
    ).json()

    assert client.delete(f"/exams/{exam['id']}", headers={"Authorization": f"Bearer {second}"}).status_code == 404
    assert client.delete(f"/exams/{exam['id']}", headers={"Authorization": f"Bearer {first}"}).status_code == 204
    assert client.get(f"/exams/{exam['id']}", headers={"Authorization": f"Bearer {first}"}).status_code == 404


def test_exam_generation_can_focus_on_day_note_topics() -> None:
    client = _client_with_memory_db()
    plan_response = client.post(
        "/prep-plans",
        json={
            "job_title": "Backend Software Engineer",
            "job_description": "Python SQL REST APIs Docker testing and system design.",
            "interview_at": (datetime.now(timezone.utc) + timedelta(days=3)).isoformat(),
            "hours_per_day": 2,
            "comfort_level": "intermediate",
        },
    )
    prep_plan_id = plan_response.json()["prep_plan_id"]

    exam_response = client.post(
        "/exams/generate",
        json={
            "prep_plan_id": prep_plan_id,
            "day": 1,
            "question_count": 3,
            "difficulty": "hard",
            "focus_topics": ["REST APIs", "SQL joins"],
        },
    )

    exam = exam_response.json()
    assert exam_response.status_code == 200
    assert {topic for question in exam["questions"] for topic in question["topics"]} <= {"REST APIs", "SQL joins"}


def test_extra_exam_scopes_are_resolved_from_the_saved_plan() -> None:
    """The Plan page sends a scope, not a browser-controlled topic list."""

    client = _client_with_memory_db()
    plan_response = client.post(
        "/prep-plans",
        json={
            "job_title": "Backend Software Engineer",
            "job_description": "Python SQL REST APIs Docker testing and system design.",
            "interview_at": (datetime.now(timezone.utc) + timedelta(days=8)).isoformat(),
            "hours_per_day": 2,
            "comfort_level": "intermediate",
        },
    )
    prep_plan_id = plan_response.json()["prep_plan_id"]
    plan = client.get(f"/prep-plans/{prep_plan_id}").json()
    selected_day = min(2, max(task["day"] for task in plan["tasks"]))

    selected_topics = {
        topic
        for task in plan["tasks"]
        if task["day"] == selected_day
        for topic in task["topics"]
    }
    through_topics = {
        topic
        for task in plan["tasks"]
        if task["day"] <= selected_day
        for topic in task["topics"]
    }

    selected_response = client.post(
        "/exams/generate",
        json={
            "prep_plan_id": prep_plan_id,
            "day": selected_day,
            "scope": "selected_day",
            # A Plan-page request must not be widened by an arbitrary payload.
            "focus_topics": ["Not in the plan"],
            "question_count": 3,
        },
    )
    through_response = client.post(
        "/exams/generate",
        json={
            "prep_plan_id": prep_plan_id,
            "day": selected_day,
            "scope": "through_selected_day",
            "question_count": 3,
        },
    )

    selected_exam = selected_response.json()
    through_exam = through_response.json()
    assert selected_response.status_code == 200
    assert through_response.status_code == 200
    assert selected_exam["scope"] == "selected_day"
    assert through_exam["scope"] == "through_selected_day"
    assert {topic for question in selected_exam["questions"] for topic in question["topics"]} <= selected_topics
    assert {topic for question in through_exam["questions"] for topic in question["topics"]} <= through_topics


def test_ai_only_study_note_generation_records_usage_without_route_error(monkeypatch) -> None:
    client = _client_with_memory_db()
    client.headers.update({"X-Allow-Local-Fallback": "false"})
    app.dependency_overrides[get_settings] = lambda: Settings(openai_api_key="test-key")

    def fake_generate_with_openai(plan, request, settings, research):
        return StudyNoteResponse(
            title=request.title,
            subtitle="AI generated",
            role=plan.job_post.title,
            topics=request.topics,
            summary="Study these topics for the interview.",
            sections=[NoteSection(title="What to know", body="Use concrete examples.", bullets=["Explain tradeoffs"])],
            deep_dive=[NoteSection(title="Deeper prep", body="Practice scenario answers.", bullets=[])],
            interview_questions=["How would you apply this topic?"],
            related_topics=["Testing"],
            resources=[StudyResource(title="Docs", url="https://example.com", why="Reference")],
            checklist=["Prepare one example"],
            source="openai",
        )

    monkeypatch.setattr("app.services.study_note_service._generate_with_openai", fake_generate_with_openai)
    plan_response = client.post(
        "/prep-plans",
        headers={"X-Allow-Local-Fallback": "true"},
        json={
            "job_title": "Backend Software Engineer",
            "job_description": "Python SQL REST APIs Docker testing and system design.",
            "interview_at": (datetime.now(timezone.utc) + timedelta(days=3)).isoformat(),
            "hours_per_day": 2,
            "comfort_level": "intermediate",
        },
    )
    prep_plan_id = plan_response.json()["prep_plan_id"]

    response = client.post(
        "/study-notes/generate",
        json={
            "prep_plan_id": prep_plan_id,
            "day": 1,
            "title": "Read notes: REST APIs",
            "topics": ["REST APIs", "Testing"],
            "instructions": "Prepare for the daily exam.",
        },
    )

    assert response.status_code == 200
    assert response.json()["source"] == "openai"


def test_openai_study_note_schema_excludes_server_only_metadata() -> None:
    schema = to_strict_json_schema(AIStudyNoteOutput)

    assert schema["additionalProperties"] is False
    assert schema["$defs"]["NoteSection"]["additionalProperties"] is False
    assert "quality_report" not in schema["properties"]
    assert "web_research" not in schema["properties"]


def test_study_note_generation_explains_when_local_ai_is_not_configured() -> None:
    client = _client_with_memory_db()
    plan = client.post(
        "/prep-plans",
        json={
            "job_title": "Data Analyst",
            "job_description": "Analyze datasets with SQL, Python, statistics, dashboards, and stakeholder communication.",
            "interview_at": (datetime.now(timezone.utc) + timedelta(days=3)).isoformat(),
            "hours_per_day": 2,
        },
    ).json()
    client.headers.update({"X-Allow-Local-Fallback": "false"})

    response = client.post(
        "/study-notes/generate",
        json={
            "prep_plan_id": plan["prep_plan_id"],
            "day": 1,
            "title": "SQL foundations",
            "topics": ["SQL"],
            "difficulty": "easy",
        },
    )

    assert response.status_code == 503
    assert "no AI provider is configured" in response.json()["detail"]


def test_study_note_generation_rejects_another_users_plan() -> None:
    client = _client_with_memory_db()
    first = _register(client, {"name": "First User", "email": "note-first@example.com", "password": "Password1!"}).json()["access_token"]
    second = _register(client, {"name": "Second User", "email": "note-second@example.com", "password": "Password1!"}).json()["access_token"]
    plan = client.post(
        "/prep-plans",
        headers={"Authorization": f"Bearer {first}"},
        json={
            "job_title": "Backend Software Engineer",
            "job_description": "Python SQL REST APIs Docker testing and system design.",
            "interview_at": (datetime.now(timezone.utc) + timedelta(days=3)).isoformat(),
            "hours_per_day": 2,
            "comfort_level": "intermediate",
        },
    ).json()

    response = client.post(
        "/study-notes/generate",
        headers={"Authorization": f"Bearer {second}"},
        json={
            "prep_plan_id": plan["prep_plan_id"],
            "day": 1,
            "title": "Read notes: REST APIs",
            "topics": ["REST APIs"],
            "instructions": "Prepare for the daily exam.",
        },
    )

    assert response.status_code == 404


def test_ai_only_exam_generation_batches_until_requested_count(monkeypatch) -> None:
    client = _client_with_memory_db()
    client.headers.update({"X-Allow-Local-Fallback": "false"})
    app.dependency_overrides[get_settings] = lambda: Settings(openai_api_key="test-key")
    batch_sizes: list[int] = []

    def fake_generate_with_openai(prompt, settings, question_count, max_output_tokens):
        batch_sizes.append(question_count)
        return {
            "questions": [
                {
                    "question_type": "short_answer",
                    "prompt": f"Question {len(batch_sizes)}-{index}: explain REST APIs with a tradeoff.",
                    "topics": ["REST APIs"],
                    "expected_answer": "A strong answer connects the topic to the job and names a tradeoff.",
                    "options": None,
                }
                for index in range(question_count)
            ]
        }

    monkeypatch.setattr("app.services.exam_service._generate_questions_with_openai", fake_generate_with_openai)
    plan_response = client.post(
        "/prep-plans",
        headers={"X-Allow-Local-Fallback": "true"},
        json={
            "job_title": "Backend Software Engineer",
            "job_description": "Python SQL REST APIs Docker testing and system design.",
            "interview_at": (datetime.now(timezone.utc) + timedelta(days=3)).isoformat(),
            "hours_per_day": 2,
            "comfort_level": "intermediate",
        },
    )
    prep_plan_id = plan_response.json()["prep_plan_id"]

    exam_response = client.post(
        "/exams/generate",
        json={"prep_plan_id": prep_plan_id, "day": 1, "question_count": 12, "difficulty": "medium"},
    )

    assert exam_response.status_code == 200
    assert len(exam_response.json()["questions"]) == 12
    assert batch_sizes == [10, 2]


def test_interview_experience_flow() -> None:
    client = _client_with_memory_db()

    response = client.post(
        "/interview-experiences",
        json={
            "company": "ExampleTech",
            "role_title": "Backend Software Engineer Intern",
            "round_name": "Technical Round",
            "topics": ["Python", "SQL", "REST APIs"],
            "questions": [
                {
                    "prompt": "Explain how you would design a REST endpoint for pagination.",
                    "topic": "REST APIs",
                    "question_type": "technical",
                }
            ],
            "difficulty": "medium",
            "notes": "Asked follow-up questions about edge cases.",
        },
    )

    body = response.json()
    assert response.status_code == 200
    assert body["id"] is not None

    detail = client.get(f"/interview-experiences/{body['id']}").json()
    assert detail["company"] == "ExampleTech"
    assert detail["questions"][0]["topic"] == "REST APIs"


def test_legacy_interview_experiences_remain_visible_but_private_records_do_not_leak() -> None:
    client = _client_with_memory_db()
    legacy = client.post(
        "/interview-experiences",
        json={
            "company": "Legacy Company",
            "role_title": "Data Analyst",
            "round_name": "Technical Round",
            "topics": ["SQL"],
            "questions": [{"prompt": "Explain a SQL join.", "topic": "SQL", "question_type": "technical"}],
            "difficulty": "medium",
        },
    ).json()
    first = _register(client, {"name": "First User", "email": "experience-first@example.com", "password": "Password1!"}).json()["access_token"]
    second = _register(client, {"name": "Second User", "email": "experience-second@example.com", "password": "Password1!"}).json()["access_token"]
    private = client.post(
        "/interview-experiences",
        headers={"Authorization": f"Bearer {first}"},
        json={
            "company": "Private Company",
            "role_title": "Backend Engineer",
            "round_name": "Hiring Manager",
            "topics": ["Python"],
            "questions": [{"prompt": "Explain an API tradeoff.", "topic": "Python", "question_type": "technical"}],
            "difficulty": "hard",
        },
    ).json()

    visible_to_second = client.get(
        "/interview-experiences",
        headers={"Authorization": f"Bearer {second}"},
    ).json()

    assert legacy["id"] in {item["id"] for item in visible_to_second}
    assert private["id"] not in {item["id"] for item in visible_to_second}
    assert client.get(
        f"/interview-experiences/{legacy['id']}",
        headers={"Authorization": f"Bearer {second}"},
    ).status_code == 200
    assert client.get(
        f"/interview-experiences/{private['id']}",
        headers={"Authorization": f"Bearer {second}"},
    ).status_code == 404


def test_mock_interview_flow() -> None:
    client = _client_with_memory_db()
    plan_response = client.post(
        "/prep-plans",
        json={
            "job_title": "Backend Software Engineer",
            "job_description": "Python SQL REST APIs Docker testing and system design.",
            "interview_at": (datetime.now(timezone.utc) + timedelta(days=3)).isoformat(),
            "hours_per_day": 2,
            "comfort_level": "intermediate",
        },
    )
    prep_plan_id = plan_response.json()["prep_plan_id"]

    start_response = client.post(
        "/mock-interviews/start",
        json={
            "prep_plan_id": prep_plan_id,
            "scope": "through_selected_day",
            "focus_topics": ["SQL joins", "Python", "SQL joins"],
        },
    )
    started = start_response.json()

    assert start_response.status_code == 200
    assert started["messages"][0]["role"] == "interviewer"
    assert started["scope"] == "through_selected_day"
    assert started["focus_topics"] == ["SQL joins", "Python"]
    assert started["current_topic"] == "SQL joins"
    assert len(started["session_plan"]) == started["question_count"]
    assert all(slot["intent"] and slot["rubric"] and slot["question"] for slot in started["session_plan"])

    answer_response = client.post(
        f"/mock-interviews/{started['id']}/answer",
        json={
            "answer_text": "I used Python in a project because it helped API speed. I tested edge cases and explained tradeoff decisions."
        },
    )
    answered = answer_response.json()

    assert answer_response.status_code == 200
    assert answered["average_score"] > 0
    feedback = next(message for message in answered["messages"] if message["role"] == "feedback")
    assert set(feedback["detail"]["dimensions"]) >= {"relevance", "depth", "structure", "communication"}
    listed = client.get(f"/mock-interviews?prep_plan_id={prep_plan_id}")
    assert listed.status_code == 200
    assert listed.json()[0]["id"] == started["id"]
    assert listed.json()[0]["created_at"]

    completed_response = client.post(f"/mock-interviews/{started['id']}/complete")
    assert completed_response.status_code == 200
    assert completed_response.json()["status"] == "complete"


def test_voice_mock_interview_persists_transcript_commands_and_scores(monkeypatch) -> None:
    client = _client_with_memory_db()
    plan = client.post(
        "/prep-plans",
        json={
            "job_title": "Backend Engineer",
            "job_description": "Build Python APIs, design SQL data models, test edge cases, and explain tradeoffs.",
            "interview_at": (datetime.now(timezone.utc) + timedelta(days=3)).isoformat(),
            "hours_per_day": 2,
            "comfort_level": "intermediate",
        },
    ).json()
    started = client.post(
        "/mock-interviews/start",
        json={"prep_plan_id": plan["prep_plan_id"], "question_count": 2},
    ).json()

    def fake_evaluate(interview, turns, substantive_indices, settings):
        return {
            index: MockVoiceAnswerEvaluation(
                candidate_turn_index=index,
                score=0.8 if position == 0 else 0.6,
                feedback="Grounded voice-answer feedback.",
                strengths=["Clear reasoning"],
                improvements=["Add one measurable result"],
                dimensions={"relevance": 0.8, "accuracy": 0.7, "depth": 0.6, "structure": 0.7, "communication": 0.8},
                competency="Python APIs",
            )
            for position, index in enumerate(substantive_indices)
        }

    monkeypatch.setattr("app.services.mock_interview_service._evaluate_voice_transcript_with_ai", fake_evaluate)
    response = client.post(
        f"/mock-interviews/{started['id']}/voice-complete",
        json={
            "turns": [
                {"role": "interviewer", "content": started["session_plan"][0]["question"]},
                {"role": "candidate", "content": "I designed a FastAPI endpoint and tested failure cases before measuring latency."},
                {"role": "candidate", "content": "Please repeat the question."},
                {"role": "interviewer", "content": started["session_plan"][1]["question"]},
                {"role": "candidate", "content": "I would validate the schema, parameterize queries, and explain the indexing tradeoff."},
                {"role": "candidate", "content": "I'm done."},
                {"role": "candidate", "content": "I got it."},
            ],
        },
    )
    body = response.json()

    assert response.status_code == 200
    assert body["status"] == "complete"
    assert body["answered_questions"] == 2
    assert body["average_score"] == 0.7
    assert len([message for message in body["messages"] if message["role"] == "feedback"]) == 2
    assert len([message for message in body["messages"] if message["role"] == "command"]) == 3
    assert _is_voice_command("Could you clarify the question?") is True
    assert _is_voice_command("Please skip this question and move to the next planned question.") is True
    assert _is_voice_command("I'm done.") is True
    assert _is_voice_command("I got it.") is True


def test_voice_scoring_schema_is_strict_and_complete() -> None:
    from openai.lib._pydantic import to_strict_json_schema

    schema = to_strict_json_schema(MockVoiceEvaluationOutput)
    answer_schema = schema["$defs"]["MockVoiceAnswerEvaluation"]
    dimension_schema = schema["$defs"]["MockScoreDimensions"]

    assert set(schema["required"]) == set(schema["properties"])
    assert set(answer_schema["required"]) == set(answer_schema["properties"])
    assert set(dimension_schema["required"]) == set(dimension_schema["properties"])
    assert dimension_schema["additionalProperties"] is False


def test_realtime_mock_endpoint_requires_server_openai_configuration() -> None:
    client = _client_with_memory_db()
    plan = client.post(
        "/prep-plans",
        json={
            "job_title": "Data Analyst",
            "job_description": "Use SQL and Tableau to validate reporting data.",
            "interview_at": (datetime.now(timezone.utc) + timedelta(days=3)).isoformat(),
            "hours_per_day": 2,
            "comfort_level": "intermediate",
        },
    ).json()
    started = client.post("/mock-interviews/start", json={"prep_plan_id": plan["prep_plan_id"]}).json()

    response = client.post(
        f"/mock-interviews/{started['id']}/realtime-call",
        content="v=0\r\no=- 1 1 IN IP4 127.0.0.1\r\n",
        headers={"Content-Type": "application/sdp"},
    )

    assert response.status_code == 503
    assert "OpenAI is not configured" in response.json()["detail"]


def test_mock_interview_complete_and_delete_respect_ownership() -> None:
    client = _client_with_memory_db()
    first = _register(client, {"name": "First User", "email": "mock-first@example.com", "password": "Password1!"}).json()["access_token"]
    second = _register(client, {"name": "Second User", "email": "mock-second@example.com", "password": "Password1!"}).json()["access_token"]
    headers = {"Authorization": f"Bearer {first}"}
    plan = client.post(
        "/prep-plans",
        headers=headers,
        json={
            "job_title": "Backend Engineer",
            "job_description": "Python SQL REST APIs Docker testing and system design.",
            "interview_at": (datetime.now(timezone.utc) + timedelta(days=3)).isoformat(),
            "hours_per_day": 2,
            "comfort_level": "intermediate",
        },
    ).json()
    started = client.post(
        "/mock-interviews/start",
        headers=headers,
        json={"prep_plan_id": plan["prep_plan_id"]},
    ).json()

    other_headers = {"Authorization": f"Bearer {second}"}
    assert client.post(f"/mock-interviews/{started['id']}/complete", headers=other_headers).status_code == 404
    assert client.delete(f"/mock-interviews/{started['id']}", headers=other_headers).status_code == 404
    completed = client.post(f"/mock-interviews/{started['id']}/complete", headers=headers)
    assert completed.status_code == 200
    assert completed.json()["status"] == "complete"
    assert completed.json()["average_score"] == 0
    assert client.delete(f"/mock-interviews/{started['id']}", headers=headers).status_code == 204
    assert client.get(f"/mock-interviews/{started['id']}", headers=headers).status_code == 404


def _request_otp(client: TestClient, email: str) -> str:
    response = client.post("/auth/register/otp", json={"email": email})
    assert response.status_code == 200
    return response.json()["dev_otp"]


def _register(client: TestClient, payload: dict[str, str]):
    code = _request_otp(client, payload["email"])
    return client.post("/auth/register", json={**payload, "otp_code": code})


def _client_with_memory_db() -> TestClient:
    app.dependency_overrides.clear()
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    def override_get_db() -> Generator[Session, None, None]:
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)
    client.headers.update({"X-Allow-Local-Fallback": "true"})
    return client
