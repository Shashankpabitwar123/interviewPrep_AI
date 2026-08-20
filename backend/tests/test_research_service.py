from app.services.research_service import _normalize_results, _rank_and_dedupe


def test_research_prefers_authoritative_sources_and_filters_weak_noise() -> None:
    items = [
        {
            "title": "Official role page",
            "url": "https://careers.examplebank.com/roles/data-analyst",
            "score": 0.35,
            "raw_content": "Official company role information describing data validation, reconciliation, and reporting responsibilities.",
        },
        {
            "title": "Python documentation",
            "url": "https://docs.python.org/3/library/sqlite3.html",
            "score": 0.78,
            "raw_content": "Official Python documentation with detailed usage guidance, examples, caveats, and API behavior for practitioners.",
        },
        {
            "title": "Low relevance blog",
            "url": "https://random-blog.example/interviews",
            "score": 0.2,
            "raw_content": "A long but weakly related page that should not become evidence for role-specific preparation content.",
        },
    ]

    normalized = _normalize_results(
        items,
        "data analyst responsibilities",
        "careers.examplebank.com",
        "Example Bank",
    )
    ranked = _rank_and_dedupe(normalized)

    assert {item.origin for item in ranked} == {"company_official", "official_reference"}
    assert ranked[0].origin == "official_reference"
    assert all(item.source_id for item in ranked)
    assert all(item.relevance_score >= 0.45 or item.authority >= 0.9 for item in ranked)


def test_research_deduplicates_urls_and_keeps_the_stronger_result() -> None:
    normalized = _normalize_results(
        [
            {
                "title": "Older snippet",
                "url": "https://docs.python.org/3/library/functions.html",
                "score": 0.55,
                "content": "Official reference content with enough explanatory detail to be accepted into the evidence collection.",
            },
            {
                "title": "Better snippet",
                "url": "https://docs.python.org/3/library/functions.html/",
                "score": 0.92,
                "content": "A stronger official reference result with clearer and more relevant guidance for interview preparation.",
            },
        ],
        "Python builtins documentation",
        "",
        "",
    )

    ranked = _rank_and_dedupe(normalized)

    assert len(ranked) == 1
    assert ranked[0].title == "Better snippet"
    assert ranked[0].relevance_score == 0.92
