import httpx

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
