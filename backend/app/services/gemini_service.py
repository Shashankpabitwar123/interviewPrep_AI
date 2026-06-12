import json
import time
from typing import Any

import httpx

from app.config import Settings


class GeminiQuotaError(RuntimeError):
    """Raised when Gemini rejects the request because the API quota is exhausted."""


def generate_gemini_json(settings: Settings, prompt: str, schema: dict[str, Any]) -> dict[str, Any]:
    """Ask Gemini for JSON that matches a small schema."""

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.gemini_model}:generateContent"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": schema,
            "temperature": 0.2,
        },
    }
    try:
        return _post_gemini_json(settings, url, payload)
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code != 400:
            raise
        # Some Gemini API versions/accounts still expect the older generationConfig
        # fields. If structured schema mode fails, ask for JSON only and validate it
        # with Pydantic in the calling service.
        fallback_payload = {
            "contents": [{"parts": [{"text": f"{prompt}\n\nReturn valid JSON only. Do not include markdown."}]}],
            "generationConfig": {
                "responseMimeType": "application/json",
                "temperature": 0.2,
            },
        }
        return _post_gemini_json(settings, url, fallback_payload)


def _post_gemini_json(settings: Settings, url: str, payload: dict[str, Any]) -> dict[str, Any]:
    response = None
    for attempt in range(5):
        response = httpx.post(
            url,
            headers={"x-goog-api-key": settings.gemini_api_key or "", "Content-Type": "application/json"},
            json=payload,
            timeout=60,
        )
        if response.status_code == 429:
            raise GeminiQuotaError("Gemini API quota or rate limit exceeded.")
        if response.status_code not in {429, 500, 502, 503, 504}:
            break
        if attempt < 4:
            time.sleep(1.5 * (attempt + 1))
    response.raise_for_status()
    data = response.json()
    content = data["candidates"][0]["content"]["parts"][0]["text"]
    return json.loads(_clean_json_content(content))


def _clean_json_content(content: str) -> str:
    cleaned = content.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.removeprefix("```json").removeprefix("```").strip()
        cleaned = cleaned.removesuffix("```").strip()
    return cleaned
