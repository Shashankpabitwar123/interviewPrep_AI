from app.config import Settings
from app.schemas.job_analysis import JobAnalysisRequest
from app.services.job_analyzer import (
    analysis_from_job_brief,
    analyze_job_description,
    build_job_description_brief,
    extract_core_skills,
    identity_hints,
    infer_company_name,
    job_identity_needs_repair,
    resolve_job_identity,
)


def test_heuristic_job_analysis_extracts_role_signals() -> None:
    request = JobAnalysisRequest(
        job_title="Backend Software Engineer Intern",
        job_description="Build Python FastAPI REST APIs with SQL, Docker, testing, and teamwork.",
    )

    result = analyze_job_description(request, Settings(openai_api_key=None))

    assert result.source == "heuristic"
    assert result.seniority == "intern"
    assert "Python" in result.required_skills
    assert "SQL" in result.required_skills
    assert result.interview_focus


def test_structured_job_brief_maps_to_the_compact_plan_analysis() -> None:
    description = """
    Junior Data Analyst
    Build SQL dashboards, validate reporting data, and explain findings to business stakeholders.
    Required: Python, SQL, Tableau, communication, and a bachelor's degree in a related field.
    """

    brief = build_job_description_brief("Junior Data Analyst", description, None, Settings(openai_api_key=None))
    compact = analysis_from_job_brief(brief)

    assert brief.analysis_version == "v2"
    assert brief.role_title == "Junior Data Analyst"
    assert brief.role_summary
    assert brief.requirements.must_have
    assert brief.interview_topics
    assert compact.required_skills
    assert compact.interview_focus


def test_core_skills_are_short_source_grounded_technologies() -> None:
    description = "Use Power BI, Tableau, SQL, Linux, and Python to build reporting workflows."

    skills = extract_core_skills(description)

    assert [skill.name for skill in skills] == ["Power BI", "Tableau", "SQL", "Linux", "Python"]
    assert all(skill.name not in {"Communication", "Problem solving"} for skill in skills)


def test_structured_brief_exposes_core_skills_to_the_compact_analysis() -> None:
    description = "Data Analyst role using Power BI, Tableau, SQL, and Excel."

    brief = build_job_description_brief("Data Analyst", description, None, Settings(openai_api_key=None))
    compact = analysis_from_job_brief(brief)

    assert [skill.name for skill in compact.core_skills] == ["Power BI", "Tableau", "SQL", "Excel"]
    assert compact.required_skills[:4] == ["Power BI", "Tableau", "SQL", "Excel"]


def test_identity_resolution_removes_browser_chrome_and_splits_company() -> None:
    captured_title = "Junior Software Engineer at now By clicking Continue to join or sign in"

    hint_title, hint_company = identity_hints(captured_title, "Auto-detect company", "Saved URL bookmark.", "https://linkedin.com/jobs/123")
    identity = resolve_job_identity(
        captured_title,
        "Auto-detect company",
        "Saved URL bookmark.",
        "https://linkedin.com/jobs/123",
        ai_title=hint_title,
        ai_company="",
    )

    assert hint_title == "Junior Software Engineer"
    assert hint_company == "now"
    assert identity.role_title == "Junior Software Engineer"
    assert identity.company == "now"
    assert "By clicking" not in identity.role_title
    assert "captured_page_company" in identity.evidence


def test_job_board_domain_is_not_mistaken_for_a_company_or_tld() -> None:
    assert infer_company_name("Auto-detect company", "Saved URL bookmark.", "https://linkedin.com/jobs/123") == ""


def test_posting_headers_outrank_conflicting_captured_page_title() -> None:
    description = """
    Company: Acme Analytics
    Job title: Data Analyst
    Build SQL dashboards and validate reporting data for business stakeholders.
    """

    identity = resolve_job_identity(
        "Careers page | LinkedIn",
        "Auto-detect company",
        description,
        "https://linkedin.com/jobs/456",
        ai_title="Data Analyst",
        ai_company="Acme Analytics",
    )

    assert identity.role_title == "Data Analyst"
    assert identity.company == "Acme Analytics"
    assert identity.confidence >= 0.98
    assert identity.needs_review is False


def test_ai_identity_outranks_polluted_capture_title_and_location() -> None:
    captured = "Frontend Developer InterEx Group United States Apply Frontend Developer InterEx Group"

    identity = resolve_job_identity(
        captured,
        "InterEx Group",
        "Frontend Developer\nInterEx Group\nBuild React and TypeScript applications.",
        "https://linkedin.com/jobs/789",
        ai_title="Frontend Developer",
        ai_company="InterEx Group",
        identity_source="capture",
    )

    assert job_identity_needs_repair(captured, "InterEx Group") is True
    assert identity.role_title == "Frontend Developer"
    assert identity.company == "InterEx Group"
    assert identity.evidence == ("ai_title", "ai_company")


def test_clean_manual_job_identity_remains_authoritative() -> None:
    identity = resolve_job_identity(
        "Product Data Analyst",
        "Acme",
        "Job title: Data Analyst\nCompany: Other Co",
        None,
        ai_title="Data Analyst",
        ai_company="Other Co",
        identity_source="manual",
    )

    assert identity.role_title == "Product Data Analyst"
    assert identity.company == "Acme"
    assert identity.evidence == ("user_title", "user_company")
