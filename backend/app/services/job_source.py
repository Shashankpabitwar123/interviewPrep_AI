from dataclasses import dataclass, field
import ipaddress
from typing import Optional
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup
import httpx

from app.config import Settings


@dataclass
class ResolvedJobSource:
    text: str
    extraction_method: str
    source_url: str | None = None
    warnings: list[str] = field(default_factory=list)

    def metadata(self) -> dict:
        return {
            "extraction_method": self.extraction_method,
            "source_url": self.source_url,
            "warnings": self.warnings,
            "character_count": len(self.text),
        }


def resolve_job_source(
    job_description: Optional[str],
    source_url: Optional[str],
    settings: Settings | None = None,
) -> ResolvedJobSource:
    if job_description:
        return ResolvedJobSource(text=job_description.strip(), extraction_method="pasted", source_url=source_url)
    if not source_url:
        raise ValueError("A job description or source URL is required.")
    try:
        text = fetch_job_description_from_url(source_url)
        return ResolvedJobSource(text=text, extraction_method="http", source_url=source_url)
    except Exception as direct_error:
        if settings and settings.tavily_enabled:
            try:
                text = _extract_with_tavily(source_url, settings)
                return ResolvedJobSource(
                    text=text,
                    extraction_method="tavily_extract",
                    source_url=source_url,
                    warnings=[f"Direct extraction failed: {type(direct_error).__name__}"],
                )
            except Exception:
                pass
        raise ValueError(
            "Could not read enough job-description text from that URL. Paste the description or use the browser capture extension."
        ) from direct_error


def resolve_job_description(
    job_description: Optional[str],
    source_url: Optional[str],
    settings: Settings | None = None,
) -> str:
    """Backward-compatible wrapper used by older callers and tests."""

    return resolve_job_source(job_description, source_url, settings).text


def fetch_job_description_from_url(source_url: str) -> str:
    """Download a public job page and extract readable text from the HTML."""

    current_url = _validated_public_url(source_url)
    response = None
    for _ in range(6):
        response = httpx.get(
            current_url,
            follow_redirects=False,
            timeout=15,
            headers={"User-Agent": "InterviewPrepAI/1.0 (+https://prepinterviewai.com)"},
        )
        if response.status_code not in {301, 302, 303, 307, 308}:
            break
        location = response.headers.get("location")
        if not location:
            raise ValueError("The job URL returned an invalid redirect.")
        current_url = _validated_public_url(urljoin(current_url, location))
    if response is None or response.status_code in {301, 302, 303, 307, 308}:
        raise ValueError("The job URL redirected too many times.")
    response.raise_for_status()
    content_type = response.headers.get("content-type", "")
    if content_type and not any(kind in content_type.lower() for kind in ("text/", "html", "json")):
        raise ValueError("The job URL did not return readable text.")

    soup = BeautifulSoup(response.text, "html.parser")
    for tag in soup(["script", "style", "noscript", "svg", "nav", "footer"]):
        tag.decompose()

    main = soup.find("main") or soup.find("article") or soup.body or soup
    text = " ".join(main.get_text(" ").split())
    if len(text) < 100:
        raise ValueError("Could not extract enough readable text from the job URL.")
    return text[:30000]


def _extract_with_tavily(source_url: str, settings: Settings) -> str:
    source_url = _validated_public_url(source_url)
    response = httpx.post(
        "https://api.tavily.com/extract",
        headers={
            "Authorization": f"Bearer {settings.tavily_api_key}",
            "Content-Type": "application/json",
            "X-Project-ID": "prepinterview-job-capture",
        },
        json={
            "urls": [source_url],
            "extract_depth": "advanced",
            "format": "markdown",
            "include_images": False,
        },
        timeout=25,
    )
    response.raise_for_status()
    data = response.json()
    result = next(iter(data.get("results") or []), {})
    text = " ".join(str(result.get("raw_content") or result.get("content") or "").split())
    if len(text) < 100:
        raise ValueError("Tavily could not extract enough readable job text.")
    return text[:30000]


def _validated_public_url(source_url: str) -> str:
    value = source_url.strip()
    if not value.startswith(("http://", "https://")):
        value = f"https://{value}"
    parsed = urlparse(value)
    host = (parsed.hostname or "").lower()
    if parsed.scheme not in {"http", "https"} or not host:
        raise ValueError("Only public HTTP or HTTPS job URLs are supported.")
    if host in {"localhost", "localhost.localdomain"} or host.endswith((".local", ".internal")):
        raise ValueError("Private network URLs are not supported.")
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        address = None
    if address and (address.is_private or address.is_loopback or address.is_link_local or address.is_reserved):
        raise ValueError("Private network URLs are not supported.")
    return value
