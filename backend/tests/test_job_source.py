import httpx
import pytest

from app.services.job_source import fetch_job_description_from_url


def test_fetch_job_description_from_url_extracts_readable_text(monkeypatch) -> None:
    html = """
    <html>
      <head><script>ignoreMe()</script></head>
      <body>
        <main>
          <h1>Backend Software Engineer Intern</h1>
          <p>We are looking for Python, FastAPI, SQL, Docker, testing, and REST API experience.</p>
          <p>This role includes debugging services, communicating clearly, and learning quickly.</p>
        </main>
      </body>
    </html>
    """

    def fake_get(*args, **kwargs):
        request = httpx.Request("GET", "https://example.com/jobs/backend-intern")
        return httpx.Response(200, text=html, request=request)

    monkeypatch.setattr("app.services.job_source.httpx.get", fake_get)

    text = fetch_job_description_from_url("https://example.com/jobs/backend-intern")

    assert "Backend Software Engineer Intern" in text
    assert "Python" in text
    assert "ignoreMe" not in text


def test_fetch_job_description_rejects_redirect_to_private_network(monkeypatch) -> None:
    def fake_get(url, **kwargs):
        request = httpx.Request("GET", url)
        return httpx.Response(302, headers={"location": "http://127.0.0.1/admin"}, request=request)

    monkeypatch.setattr("app.services.job_source.httpx.get", fake_get)

    with pytest.raises(ValueError, match="Private network URLs"):
        fetch_job_description_from_url("https://example.com/jobs/analyst")


def test_fetch_job_description_prefers_schema_job_identity(monkeypatch) -> None:
    html = """
    <html>
      <head>
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "JobPosting",
            "title": "Junior Data Analyst",
            "hiringOrganization": {"@type": "Organization", "name": "Morgan Stanley"},
            "description": "<p>Build SQL reports, validate data, and explain findings to stakeholders.</p>"
          }
        </script>
      </head>
      <body><main><p>Navigation and unrelated page text that should not replace the structured posting.</p></main></body>
    </html>
    """

    def fake_get(*args, **kwargs):
        request = httpx.Request("GET", "https://careers.example.com/jobs/data-analyst")
        return httpx.Response(200, text=html, request=request)

    monkeypatch.setattr("app.services.job_source.httpx.get", fake_get)

    text = fetch_job_description_from_url("https://careers.example.com/jobs/data-analyst")

    assert text.startswith("Job title: Junior Data Analyst\nCompany: Morgan Stanley")
    assert "Build SQL reports" in text
