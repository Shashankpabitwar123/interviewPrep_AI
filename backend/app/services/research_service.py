import logging
from dataclasses import dataclass

import httpx

from app.config import Settings


logger = logging.getLogger(__name__)


@dataclass
class ResearchResult:
    title: str
    url: str
    content: str
    query: str


def research_for_note(
    settings: Settings | None,
    role: str,
    company: str,
    topics: list[str],
    job_description: str,
) -> list[ResearchResult]:
    if not settings or not settings.tavily_enabled:
        return []

    queries = _research_queries(role, company, topics, job_description)
    results: list[ResearchResult] = []
    seen_urls: set[str] = set()
    for query in queries:
        try:
            for item in _tavily_search(settings, query):
                url = item.get("url") or ""
                if not url or url in seen_urls:
                    continue
                seen_urls.add(url)
                results.append(
                    ResearchResult(
                        title=item.get("title") or "Research source",
                        url=url,
                        content=item.get("content") or item.get("snippet") or "",
                        query=query,
                    )
                )
        except Exception as exc:
            logger.warning("Tavily research failed for query %s: %s", query, exc)
        if len(results) >= 6:
            break
    return results[:6]


def _tavily_search(settings: Settings, query: str) -> list[dict]:
    response = httpx.post(
        "https://api.tavily.com/search",
        headers={
            "Authorization": f"Bearer {settings.tavily_api_key}",
            "Content-Type": "application/json",
        },
        json={
            "query": query,
            "search_depth": "basic",
            "topic": "general",
            "max_results": 3,
            "include_answer": False,
            "include_raw_content": False,
            "include_images": False,
            "exclude_domains": [
                "linkedin.com",
                "glassdoor.com",
                "indeed.com",
                "reddit.com",
                "quora.com",
                "scribd.com",
                "coursehero.com",
                "chegg.com",
                "studocu.com",
                "slideshare.net",
                "instagram.com",
                "facebook.com",
                "tiktok.com",
                "youtube.com",
                "pinterest.com",
                "x.com",
                "twitter.com",
            ],
        },
        timeout=12,
    )
    response.raise_for_status()
    data = response.json()
    return data.get("results", [])


def _research_queries(role: str, company: str, topics: list[str], job_description: str) -> list[str]:
    topic_text = " ".join(topics[:3])
    description = job_description.lower()
    queries = [
        f"{role} interview questions {topic_text}".strip(),
        f"{role} interview preparation current topics".strip(),
    ]
    if company:
        queries.append(f"{company} {role} interview process questions")
    for topic in topics[:3]:
        queries.append(f"{topic} interview questions practical examples")
        queries.append(f"{topic} official documentation best practices")
    if any(word in description for word in ["rhino", "twinmotion", "landscape", "estimator"]):
        queries.extend(
            [
                "landscape designer estimator interview questions",
                "Rhino 3D Twinmotion landscape design interview preparation",
                "landscape architecture project management estimating interview questions",
            ]
        )
    if any(word in description for word in ["python", "fastapi", "sql", "docker", "api"]):
        queries.extend(
            [
                "backend intern FastAPI SQL Docker interview questions",
                "REST API SQL backend interview preparation practical questions",
            ]
        )
    return list(dict.fromkeys(query for query in queries if len(query) > 8))[:4]
