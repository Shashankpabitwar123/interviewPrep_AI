import logging
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from urllib.parse import urlparse

import httpx
from sqlalchemy.orm import Session

from app.config import Settings
from app.models import JobPost, ResearchSnapshot
from app.schemas.role_intelligence import EvidenceSource


logger = logging.getLogger(__name__)
RESEARCH_VERSION = "role-research-v1"
MIN_RELEVANCE_SCORE = 0.45


@dataclass
class ResearchResult:
    title: str
    url: str
    content: str
    query: str
    source_id: str = ""
    origin: str = "web_research"
    authority: float = 0.5
    relevance_score: float = 0.5

    def to_evidence_source(self) -> EvidenceSource:
        return EvidenceSource(
            source_id=self.source_id or _source_id(self.url),
            title=self.title,
            url=self.url,
            origin=self.origin,
            authority=self.authority,
            relevance_score=self.relevance_score,
            summary=self.content[:1800],
            query=self.query,
        )


@dataclass
class ResearchBundle:
    results: list[ResearchResult] = field(default_factory=list)
    queries: list[dict] = field(default_factory=list)
    status: str = "not_configured"
    provider: str = "tavily"
    cached: bool = False
    snapshot_id: int | None = None


def description_hash(description: str) -> str:
    normalized = " ".join((description or "").split())
    return sha256(normalized.encode("utf-8")).hexdigest()


def research_for_note(
    settings: Settings | None,
    role: str,
    company: str,
    topics: list[str],
    job_description: str,
) -> list[ResearchResult]:
    """Backward-compatible note research entrypoint using the shared policy."""

    return research_for_role(
        settings,
        role=role,
        company=company,
        topics=topics,
        job_description=job_description,
    ).results


def research_for_role(
    settings: Settings | None,
    *,
    role: str,
    company: str,
    topics: list[str],
    job_description: str,
    source_url: str | None = None,
) -> ResearchBundle:
    """Collect a small, ranked evidence bundle for one role."""

    if not settings or not settings.tavily_enabled:
        return ResearchBundle(status="not_configured")

    queries = _research_queries(role, company, topics, job_description)
    official_host = _host(source_url)
    collected: list[ResearchResult] = []
    query_log: list[dict] = []

    with ThreadPoolExecutor(max_workers=min(4, len(queries))) as executor:
        futures = {executor.submit(_tavily_search, settings, query): query for query in queries}
        for future in as_completed(futures):
            query = futures[future]
            try:
                items = future.result()
                query_log.append({"query": query, "result_count": len(items), "status": "complete"})
                collected.extend(_normalize_results(items, query, official_host, company))
            except Exception as exc:
                logger.warning("Tavily research failed for query %s: %s", query, exc)
                query_log.append({"query": query, "result_count": 0, "status": "failed"})

    ranked = _rank_and_dedupe(collected)[:10]
    all_complete = query_log and all(item["status"] == "complete" for item in query_log)
    status = "complete" if ranked and all_complete else "partial" if ranked else "failed"
    return ResearchBundle(results=ranked, queries=query_log, status=status)


def get_or_create_research_snapshot(
    db: Session,
    job: JobPost,
    settings: Settings | None,
    *,
    topics: list[str] | None = None,
    force: bool = False,
) -> ResearchBundle:
    fingerprint = description_hash(job.description)
    if not force:
        cached = _latest_valid_snapshot(db, job.id, fingerprint, settings)
        if cached is not None:
            return _bundle_from_snapshot(cached)

    bundle = research_for_role(
        settings,
        role=job.title,
        company=job.company or "",
        topics=topics or [],
        job_description=job.description,
        source_url=job.source_url,
    )
    snapshot = _save_bundle(db, job, bundle, fingerprint)
    bundle.snapshot_id = snapshot.id
    return bundle


def save_research_bundle(db: Session, job: JobPost, bundle: ResearchBundle) -> ResearchSnapshot:
    """Persist research already collected before a new job received its ID."""

    snapshot = _save_bundle(db, job, bundle, description_hash(job.description))
    bundle.snapshot_id = snapshot.id
    return snapshot


def get_research_bundle(db: Session, snapshot_id: int | None) -> ResearchBundle | None:
    """Load a persisted evidence bundle without issuing another provider call."""

    if snapshot_id is None:
        return None
    snapshot = db.get(ResearchSnapshot, snapshot_id)
    return _bundle_from_snapshot(snapshot) if snapshot is not None else None


def _save_bundle(db: Session, job: JobPost, bundle: ResearchBundle, fingerprint: str) -> ResearchSnapshot:
    snapshot = ResearchSnapshot(
        job_post_id=job.id,
        description_hash=fingerprint,
        research_version=RESEARCH_VERSION,
        provider=bundle.provider,
        status=bundle.status,
        sources=[item.to_evidence_source().model_dump(mode="json") for item in bundle.results],
        query_log=bundle.queries,
    )
    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)
    return snapshot


def _latest_valid_snapshot(
    db: Session,
    job_post_id: int,
    fingerprint: str,
    settings: Settings | None,
) -> ResearchSnapshot | None:
    snapshot = (
        db.query(ResearchSnapshot)
        .filter(
            ResearchSnapshot.job_post_id == job_post_id,
            ResearchSnapshot.description_hash == fingerprint,
            ResearchSnapshot.research_version == RESEARCH_VERSION,
        )
        .order_by(ResearchSnapshot.created_at.desc(), ResearchSnapshot.id.desc())
        .first()
    )
    if snapshot is None:
        return None
    created_at = snapshot.created_at
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    cache_hours = settings.research_cache_hours if settings else 168
    if datetime.now(timezone.utc) - created_at > timedelta(hours=cache_hours):
        return None
    return snapshot


def _bundle_from_snapshot(snapshot: ResearchSnapshot) -> ResearchBundle:
    results: list[ResearchResult] = []
    for value in snapshot.sources or []:
        try:
            source = EvidenceSource.model_validate(value)
        except Exception:
            continue
        results.append(ResearchResult(
            title=source.title,
            url=source.url or "",
            content=source.summary,
            query=source.query,
            source_id=source.source_id,
            origin=source.origin,
            authority=source.authority,
            relevance_score=source.relevance_score,
        ))
    return ResearchBundle(
        results=results,
        queries=snapshot.query_log or [],
        status=snapshot.status,
        provider=snapshot.provider,
        cached=True,
        snapshot_id=snapshot.id,
    )


def _research_queries(role: str, company: str, topics: list[str], job_description: str) -> list[str]:
    clean_role = _clean_query(role) or "target role"
    clean_company = _clean_query(company)
    priority_topics = [_clean_query(topic) for topic in topics if _clean_query(topic)][:3]
    queries = [f'"{clean_role}" responsibilities skills official']
    if clean_company:
        queries.insert(0, f'"{clean_company}" "{clean_role}" careers role')
        queries.append(f'"{clean_company}" company products team official')
    if priority_topics:
        queries.append(f'{" ".join(priority_topics)} official documentation practical guide')
    elif job_description:
        named = _named_terms(job_description)
        if named:
            queries.append(f'{" ".join(named[:3])} official documentation practical guide')
    return list(dict.fromkeys(queries))[:4]


def _tavily_search(settings: Settings, query: str) -> list[dict]:
    depth = settings.tavily_search_depth if settings.tavily_search_depth in {"basic", "advanced", "fast", "ultra-fast"} else "advanced"
    response = httpx.post(
        "https://api.tavily.com/search",
        headers={
            "Authorization": f"Bearer {settings.tavily_api_key}",
            "Content-Type": "application/json",
            "X-Project-ID": "prepinterview-role-intelligence",
        },
        json={
            "query": query,
            "search_depth": depth,
            "chunks_per_source": 2,
            "topic": "general",
            "max_results": settings.tavily_max_results,
            "include_answer": False,
            "include_raw_content": True,
            "include_images": False,
            "safe_search": True,
            "exclude_domains": [
                "linkedin.com", "glassdoor.com", "indeed.com", "reddit.com", "quora.com",
                "scribd.com", "coursehero.com", "chegg.com", "studocu.com", "slideshare.net",
                "instagram.com", "facebook.com", "tiktok.com", "youtube.com", "pinterest.com",
                "x.com", "twitter.com",
            ],
        },
        timeout=18,
    )
    response.raise_for_status()
    return response.json().get("results", [])


def _normalize_results(items: list[dict], query: str, official_host: str, company: str) -> list[ResearchResult]:
    results: list[ResearchResult] = []
    for item in items:
        url = str(item.get("url") or "").strip()
        if not url:
            continue
        score = _bounded_score(item.get("score"), 0.5)
        host = _host(url)
        origin, authority = _source_authority(host, official_host, company)
        if score < MIN_RELEVANCE_SCORE and authority < 0.9:
            continue
        raw_content = item.get("raw_content") or item.get("content") or item.get("snippet") or ""
        content = re.sub(r"\s+", " ", str(raw_content)).strip()[:2400]
        if len(content) < 60:
            continue
        results.append(ResearchResult(
            title=str(item.get("title") or host or "Research source")[:240],
            url=url,
            content=content,
            query=query,
            source_id=_source_id(url),
            origin=origin,
            authority=authority,
            relevance_score=score,
        ))
    return results


def _rank_and_dedupe(results: list[ResearchResult]) -> list[ResearchResult]:
    best_by_url: dict[str, ResearchResult] = {}
    for result in results:
        key = result.url.rstrip("/").casefold()
        current = best_by_url.get(key)
        if current is None or _rank_score(result) > _rank_score(current):
            best_by_url[key] = result
    return sorted(best_by_url.values(), key=_rank_score, reverse=True)


def _rank_score(result: ResearchResult) -> float:
    return round(result.authority * 0.55 + result.relevance_score * 0.45, 4)


def _source_authority(host: str, official_host: str, company: str) -> tuple[str, float]:
    if official_host and (host == official_host or host.endswith(f".{official_host}")):
        return "company_official", 1.0
    if host.endswith(".gov") or host.endswith(".edu") or host in {"onetonline.org", "services.onetcenter.org"}:
        return "occupation_standard", 0.98
    official_reference_hosts = {
        "docs.python.org", "developer.mozilla.org", "learn.microsoft.com", "docs.aws.amazon.com",
        "cloud.google.com", "docs.github.com", "react.dev", "kubernetes.io", "docs.docker.com",
    }
    if host in official_reference_hosts:
        return "official_reference", 0.95
    company_token = re.sub(r"[^a-z0-9]", "", company.lower())
    host_token = re.sub(r"[^a-z0-9]", "", host.split(".")[0])
    if company_token and len(company_token) > 3 and (company_token in host_token or host_token in company_token):
        return "company_official", 0.92
    return "web_research", 0.55


def _source_id(url: str) -> str:
    return f"web-{sha256(url.rstrip('/').casefold().encode('utf-8')).hexdigest()[:12]}"


def _host(url: str | None) -> str:
    if not url:
        return ""
    try:
        return (urlparse(url if "://" in url else f"https://{url}").hostname or "").lower().removeprefix("www.")
    except ValueError:
        return ""


def _bounded_score(value: object, default: float) -> float:
    try:
        return max(0.0, min(1.0, float(value)))
    except (TypeError, ValueError):
        return default


def _clean_query(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9+#./ -]", " ", value or "").strip()[:100]


def _named_terms(description: str) -> list[str]:
    candidates = re.findall(
        r"\b(?:Python|SQL|Tableau|Power BI|Excel|AWS|Azure|React|Java|JavaScript|Docker|Kubernetes)\b",
        description,
        flags=re.IGNORECASE,
    )
    return list(dict.fromkeys(term.title() if term.lower() != "sql" else "SQL" for term in candidates))[:5]
