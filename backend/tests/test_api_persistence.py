from datetime import datetime, timedelta, timezone
from collections.abc import Generator

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import Settings, get_settings
from app.database import Base, get_db
from app.main import app
from app.schemas.study_note import NoteSection, StudyNoteResponse, StudyResource


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
    assert detail["analysis"]["source"] == "heuristic"


def test_logged_in_users_only_see_their_own_jobs() -> None:
    client = _client_with_memory_db()
    first = _register(client, {"name": "First User", "email": "first@example.com", "password": "password123"}).json()["access_token"]
    second = _register(client, {"name": "Second User", "email": "second@example.com", "password": "password123"}).json()["access_token"]

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

    start_response = client.post("/mock-interviews/start", json={"prep_plan_id": prep_plan_id})
    started = start_response.json()

    assert start_response.status_code == 200
    assert started["messages"][0]["role"] == "interviewer"

    answer_response = client.post(
        f"/mock-interviews/{started['id']}/answer",
        json={
            "answer_text": "I used Python in a project because it helped API speed. I tested edge cases and explained tradeoff decisions."
        },
    )
    answered = answer_response.json()

    assert answer_response.status_code == 200
    assert answered["average_score"] > 0
    assert any(message["role"] == "feedback" for message in answered["messages"])


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
