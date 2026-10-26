"""Chamadas HTTP diretas ao Google Gemini usando a key enviada pela extensao (nao persistida)."""
import requests

from ....shared.json_utils import parse_json_loosely
from .common import require_key

GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta"

DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"


def fetch_gemini_models(gemini_key):
    key = require_key(gemini_key, "Gemini")

    response = requests.get(f"{GEMINI_BASE_URL}/models", params={"key": key}, timeout=15)
    if not response.ok:
        raise RuntimeError(f"Gemini Models Error: {response.status_code}: {response.text}")

    data = response.json()
    models = [
        item.get("name", "").replace("models/", "")
        for item in data.get("models", [])
    ]
    return sorted(
        name
        for name in models
        if "gemini-" in name and "t" in name and "gemini" in name
    )


def gemini_json_prompt(prompt, gemini_key, model=None, temperature=0.2, response_schema=None):
    key = require_key(gemini_key, "Gemini")
    model = model or DEFAULT_GEMINI_MODEL

    generation_config = {"temperature": temperature, "responseMimeType": "application/json"}
    if response_schema:
        generation_config["responseSchema"] = response_schema

    payload = {"contents": [{"parts": [{"text": str(prompt or "")}]}], "generationConfig": generation_config}

    response = requests.post(
        f"{GEMINI_BASE_URL}/models/{model}:generateContent",
        params={"key": key},
        json=payload,
        timeout=90,
    )

    if not response.ok:
        raise RuntimeError(f"Gemini Error: {response.text}")

    result = response.json()
    raw_text = (
        (result.get("candidates") or [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
    )
    return parse_json_loosely(raw_text)


def gemini_text_prompt(prompt, gemini_key, model=None, temperature=0.3):
    key = require_key(gemini_key, "Gemini")
    model = model or DEFAULT_GEMINI_MODEL

    payload = {"contents": [{"parts": [{"text": str(prompt or "")}]}], "generationConfig": {"temperature": temperature}}

    response = requests.post(
        f"{GEMINI_BASE_URL}/models/{model}:generateContent",
        params={"key": key},
        json=payload,
        timeout=90,
    )

    if not response.ok:
        raise RuntimeError(f"Gemini Error: {response.text}")

    result = response.json()
    return (result.get("candidates") or [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
