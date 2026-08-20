from datetime import datetime, timedelta, timezone

from app.config import Settings
from app.schemas.prep_plan import PrepPlanRequest, PrepTaskType
from app.schemas.role_intelligence import RoleBlueprint, RoleCompetency
from app.services import planner
from app.services.planner import generate_prep_plan


def test_prep_days_follow_calendar_dates_instead_of_rounded_hours(monkeypatch) -> None:
    class FixedDateTime(datetime):
        @classmethod
        def now(cls, tz=None):
            return cls(2026, 8, 17, 14, 0, tzinfo=tz)

    monkeypatch.setattr(planner, "datetime", FixedDateTime)

    assert planner._days_until(datetime(2026, 8, 28, 23, 59, tzinfo=timezone.utc)) == 11


def test_generate_four_day_plan_includes_diagnostic_and_revision() -> None:
    request = PrepPlanRequest(
        job_title="Backend Software Engineer",
        job_description="We need Python, SQL, REST API, Docker, testing, and system design experience.",
        interview_at=datetime.now(timezone.utc) + timedelta(days=4),
        hours_per_day=2,
    )

    plan = generate_prep_plan(request)

    assert plan.days_until_interview == 4
    assert {skill.name for skill in plan.detected_skills} >= {"Python", "SQL", "REST APIs", "Docker"}
    assert plan.tasks[0].task_type == PrepTaskType.diagnostic
    assert any(task.task_type == PrepTaskType.revision for task in plan.tasks if task.day == 4)


def test_generate_plan_has_at_least_one_day_for_past_interview_time() -> None:
    request = PrepPlanRequest(
        job_title="Software Engineer Intern",
        job_description="Python algorithms and REST API work for a backend internship.",
        interview_at=datetime.now(timezone.utc) - timedelta(hours=1),
    )

    plan = generate_prep_plan(request)

    assert plan.days_until_interview == 1
    assert plan.tasks


def test_generate_plan_uses_ai_when_settings_have_api_key(monkeypatch) -> None:
    request = PrepPlanRequest(
        job_title="Backend Engineer Intern",
        job_description="Python APIs SQL and Docker.",
        interview_at=datetime.now(timezone.utc) + timedelta(days=2),
    )

    def fake_openai_plan(request, settings, days_until_interview):
        plan = generate_prep_plan(request)
        return plan.model_copy(update={"plan_source": "openai", "days_until_interview": days_until_interview})

    monkeypatch.setattr("app.services.planner._generate_with_openai", fake_openai_plan)

    plan = generate_prep_plan(request, Settings(openai_api_key="test-key"))

    assert plan.plan_source == "openai"


def test_generate_plan_falls_back_when_ai_fails(monkeypatch) -> None:
    request = PrepPlanRequest(
        job_title="Backend Engineer Intern",
        job_description="Python APIs SQL and Docker.",
        interview_at=datetime.now(timezone.utc) + timedelta(days=2),
    )

    def broken_openai_plan(request, settings, days_until_interview):
        raise RuntimeError("network failed")

    monkeypatch.setattr("app.services.planner._generate_with_openai", broken_openai_plan)

    plan = generate_prep_plan(request, Settings(openai_api_key="test-key"))

    assert plan.plan_source == "heuristic_fallback"
    assert plan.tasks


def test_role_blueprint_critical_competencies_are_covered_by_plan() -> None:
    request = PrepPlanRequest(
        job_title="Risk Data Analyst",
        job_description="Prepare reconciled datasets and report findings to risk stakeholders.",
        interview_at=datetime.now(timezone.utc) + timedelta(days=3),
    )
    blueprint = RoleBlueprint(
        source_fingerprint="fingerprint",
        role_title="Risk Data Analyst",
        role_summary="Support reliable risk reporting.",
        competencies=[
            RoleCompetency(
                name="Data reconciliation",
                category="domain",
                priority="critical",
                why_it_matters="The posting makes dataset accuracy a core responsibility.",
            ),
            RoleCompetency(
                name="Stakeholder communication",
                category="behavioral",
                priority="important",
                why_it_matters="The role presents findings to risk partners.",
            ),
        ],
    )

    plan = generate_prep_plan(request, blueprint=blueprint)
    covered_topics = {topic for task in plan.tasks for topic in task.topics}

    assert plan.role_blueprint_version == "v3"
    assert "Data reconciliation" in covered_topics
    assert [skill.name for skill in plan.detected_skills][:2] == ["Data reconciliation", "Stakeholder communication"]
