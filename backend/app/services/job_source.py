from bs4 import BeautifulSoup
import httpx
from typing import Optional


def resolve_job_description(job_description: Optional[str], source_url: Optional[str]) -> str:
    """Use pasted text when available, otherwise fetch readable text from a URL."""

    if job_description:
        return job_description
    if not source_url:
        raise ValueError("A job description or source URL is required.")
    return fetch_job_description_from_url(source_url)


def fetch_job_description_from_url(source_url: str) -> str:
    """Download a job page and extract readable text from the HTML."""

    if not source_url.startswith(("http://", "https://")):
        source_url = f"https://{source_url}"

    response = httpx.get(
        source_url,
        follow_redirects=True,
        timeout=15,
        headers={"User-Agent": "InterviewPrepAI/0.1"},
    )
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")
    for tag in soup(["script", "style", "noscript", "svg"]):
        tag.decompose()

    main = soup.find("main") or soup.find("article") or soup.body or soup
    text = " ".join(main.get_text(" ").split())
    if len(text) < 100:
        raise ValueError("Could not extract enough readable text from the job URL.")
    return text
