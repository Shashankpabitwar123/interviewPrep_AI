from app.config import Settings
from app.schemas.job_analysis import JobAnalysisRequest
from app.services.job_analyzer import analyze_job_description


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

