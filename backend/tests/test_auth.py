from collections.abc import Generator

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import get_settings
from app.database import Base, get_db
from app.main import app
from app.models import AnswerAttempt, Exam, JobAnalysis, JobPost, MockInterview, MockMessage, PrepPlan, PrepTask, Question, User


def test_register_creates_user_without_exposing_password() -> None:
    client = _client_with_memory_db()
    payload = {"name": "Shashank", "email": "Shashank@example.com", "password": "password123"}

    response = _register(client, payload)

    body = response.json()
    assert response.status_code == 200
    assert body["user"]["name"] == "Shashank"
    assert body["user"]["email"] == "shashank@example.com"
    assert body["access_token"]
    assert body["token_type"] == "bearer"
    assert "password" not in body["user"]


def test_register_rejects_duplicate_email() -> None:
    client = _client_with_memory_db()
    payload = {"name": "Shashank", "email": "shashank@example.com", "password": "password123"}

    assert _register(client, payload).status_code == 200
    response = client.post("/auth/register/otp", json={"email": payload["email"]})

    assert response.status_code == 409


def test_register_requires_email_otp() -> None:
    client = _client_with_memory_db()

    response = client.post(
        "/auth/register",
        json={"name": "Shashank", "email": "shashank@example.com", "password": "password123"},
    )

    assert response.status_code == 400
    assert "verification code" in response.json()["detail"].lower()


def test_register_rejects_wrong_email_otp() -> None:
    client = _client_with_memory_db()
    client.post("/auth/register/otp", json={"email": "shashank@example.com"})

    response = client.post(
        "/auth/register",
        json={"name": "Shashank", "email": "shashank@example.com", "password": "password123", "otp_code": "111111"},
    )

    assert response.status_code == 400
    assert "incorrect" in response.json()["detail"].lower()


def test_register_otp_can_send_with_resend(monkeypatch) -> None:
    client = _client_with_memory_db()
    captured = {}

    def fake_post(url, headers, json, timeout):
        captured["url"] = url
        captured["headers"] = headers
        captured["json"] = json
        captured["timeout"] = timeout

        class Response:
            def raise_for_status(self) -> None:
                return None

        return Response()

    monkeypatch.setenv("EMAIL_PROVIDER", "resend")
    monkeypatch.setenv("RESEND_API_KEY", "re_test_key")
    monkeypatch.setenv("EMAIL_FROM", "InterviewPrep AI <onboarding@resend.dev>")
    monkeypatch.setenv("EMAIL_OTP_DEV_MODE", "false")
    monkeypatch.setattr("app.services.email_service.httpx.post", fake_post)
    get_settings.cache_clear()

    response = client.post("/auth/register/otp", json={"email": "Shashank@example.com"})

    assert response.status_code == 200
    assert response.json()["dev_otp"] is None
    assert captured["url"] == "https://api.resend.com/emails"
    assert captured["headers"]["Authorization"] == "Bearer re_test_key"
    assert captured["json"]["from"] == "InterviewPrep AI <onboarding@resend.dev>"
    assert captured["json"]["to"] == ["shashank@example.com"]
    assert captured["json"]["subject"] == "Your InterviewPrep AI verification code"
    assert "verification code" in captured["json"]["html"].lower()
    assert captured["timeout"] == 12
    get_settings.cache_clear()


def test_register_rejects_password_without_letter_and_number() -> None:
    client = _client_with_memory_db()

    no_number = client.post(
        "/auth/register",
        json={"name": "Test User", "email": "test1@example.com", "password": "passwordonly"},
    )
    no_letter = client.post(
        "/auth/register",
        json={"name": "Test User", "email": "test2@example.com", "password": "12345678"},
    )

    assert no_number.status_code == 422
    assert no_letter.status_code == 422


def test_login_accepts_correct_password_and_rejects_wrong_password() -> None:
    client = _client_with_memory_db()
    _register(client, {"name": "Shashank", "email": "shashank@example.com", "password": "password123"})

    login = client.post("/auth/login", json={"email": "shashank@example.com", "password": "password123"})
    wrong_password = client.post("/auth/login", json={"email": "shashank@example.com", "password": "wrongpass123"})

    assert login.status_code == 200
    assert login.json()["user"]["email"] == "shashank@example.com"
    assert login.json()["access_token"]
    assert wrong_password.status_code == 401


def test_me_reads_user_from_bearer_token() -> None:
    client = _client_with_memory_db()
    register = _register(client, {"name": "Shashank", "email": "shashank@example.com", "password": "password123"})
    token = register.json()["access_token"]

    response = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    assert response.json()["email"] == "shashank@example.com"


def test_delete_account_removes_user_owned_jobs_and_allows_re_registration() -> None:
    client = _client_with_memory_db()
    register = _register(client, {"name": "Shashank", "email": "spabitwa@asu.edu", "password": "password123"})
    token = register.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    db = next(client.app.dependency_overrides[get_db]())

    db.add(
        JobPost(
            user_id=register.json()["user"]["id"],
            title="Backend Intern",
            company="ExampleTech",
            description="Build FastAPI services and write tests.",
        )
    )
    db.commit()
    job = db.query(JobPost).filter(JobPost.title == "Backend Intern").one()
    db.add(
        JobAnalysis(
            job_post_id=job.id,
            seniority="intern",
            required_skills=["FastAPI"],
            interview_focus=[],
            coding_difficulty="medium",
            behavioral_themes=[],
            source="test",
        )
    )
    db.add(PrepPlan(job_post_id=job.id, days_until_interview=3, summary="Test plan"))
    db.commit()
    plan = db.query(PrepPlan).filter(PrepPlan.job_post_id == job.id).one()
    db.add(PrepTask(prep_plan_id=plan.id, day=1, title="Read notes", task_type="study_notes", duration_minutes=30, topics=["FastAPI"], instructions="Study"))
    db.add(Exam(prep_plan_id=plan.id, title="Day 1 Exam", day=1, time_limit_minutes=10))
    db.add(MockInterview(prep_plan_id=plan.id, current_topic="FastAPI", status="active"))
    db.commit()
    exam = db.query(Exam).filter(Exam.prep_plan_id == plan.id).one()
    mock = db.query(MockInterview).filter(MockInterview.prep_plan_id == plan.id).one()
    db.add(Question(exam_id=exam.id, question_type="short_answer", prompt="Explain FastAPI.", topics=["FastAPI"]))
    db.add(MockMessage(mock_interview_id=mock.id, role="interviewer", content="Tell me about FastAPI."))
    db.commit()
    question = db.query(Question).filter(Question.exam_id == exam.id).one()
    db.add(AnswerAttempt(question_id=question.id, answer_text="It is a Python API framework.", score=1.0, feedback="Good"))
    db.commit()
    plan_id = plan.id
    exam_id = exam.id
    mock_id = mock.id

    response = client.delete("/auth/me", headers=headers)

    assert response.status_code == 204
    assert client.get("/auth/me", headers=headers).status_code == 401
    assert db.query(User).filter(User.email == "spabitwa@asu.edu").first() is None
    assert db.query(JobPost).filter(JobPost.title == "Backend Intern").first() is None
    assert db.query(PrepPlan).filter(PrepPlan.id == plan_id).first() is None
    assert db.query(Exam).filter(Exam.id == exam_id).first() is None
    assert db.query(MockInterview).filter(MockInterview.id == mock_id).first() is None

    code = _request_otp(client, "spabitwa@asu.edu")
    recreate = client.post(
        "/auth/register",
        json={"name": "Shashank", "email": "spabitwa@asu.edu", "password": "newpass123", "otp_code": code},
    )
    assert recreate.status_code == 200


def test_delete_account_requires_login() -> None:
    client = _client_with_memory_db()

    response = client.delete("/auth/me")

    assert response.status_code == 401


def test_delete_account_supports_post_fallback() -> None:
    client = _client_with_memory_db()
    register = _register(client, {"name": "Shashank", "email": "fallback@example.com", "password": "password123"})
    token = register.json()["access_token"]

    response = client.post("/auth/me/delete", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 204
    assert client.get("/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401


def test_password_is_hashed_in_database() -> None:
    client = _client_with_memory_db()
    db = next(client.app.dependency_overrides[get_db]())

    _register(client, {"name": "Shashank", "email": "shashank@example.com", "password": "password123"})

    user = db.query(User).filter(User.email == "shashank@example.com").first()
    assert user is not None
    assert user.password_hash != "password123"
    assert user.password_hash.startswith("pbkdf2_sha256$")


def _request_otp(client: TestClient, email: str) -> str:
    response = client.post("/auth/register/otp", json={"email": email})
    assert response.status_code == 200
    body = response.json()
    assert body["expires_in_minutes"] > 0
    assert body["dev_otp"]
    return body["dev_otp"]


def _register(client: TestClient, payload: dict[str, str]):
    code = _request_otp(client, payload["email"])
    return client.post("/auth/register", json={**payload, "otp_code": code})


def _client_with_memory_db() -> TestClient:
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
    return TestClient(app)
