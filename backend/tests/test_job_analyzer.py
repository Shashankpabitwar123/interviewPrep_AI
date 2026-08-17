from app.config import Settings
from app.schemas.job_analysis import JobAnalysisRequest
from app.services.job_analyzer import analysis_from_job_brief, analyze_job_description, build_job_description_brief


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
