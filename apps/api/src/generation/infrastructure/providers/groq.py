"""Chamadas HTTP diretas ao Groq usando a key enviada pela extensao (nao persistida)."""
import requests

from ....shared.json_utils import parse_json_loosely
from .common import require_key

GROQ_BASE_URL = "https://api.groq.com/openai/v1"

DEFAULT_GROQ_MODEL = "llama3-70b-8192"


def fetch_groq_models(groq_key):
    key = require_key(groq_key, "Groq")

    response = requests.get(
        f"{GROQ_BASE_URL}/models", headers={"Authorization": f"Bearer {key}"}, timeout=15
    )
    if not response.ok:
        raise RuntimeError(f"Groq Models Error: {response.status_code}: {response.text}")

    result = response.json()
    ids = [item.get("id", "") for item in result.get("data", [])]
    return sorted(id_ for id_ in ids if "whisper" not in id_ and "tool-use" not in id_)


def groq_json_prompt(prompt, groq_key, model=None, temperature=0.2, system_prompt=None):
    key = require_key(groq_key, "Groq")
    model = model or DEFAULT_GROQ_MODEL
    system_prompt = system_prompt or "Voce e um especialista em QA e deve retornar apenas JSON valido."

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": str(prompt or "")},
        ],
        "temperature": temperature,
        "response_format": {"type": "json_object"},
    }

    response = requests.post(
        f"{GROQ_BASE_URL}/chat/completions",
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}"},
        json=payload,
        timeout=90,
    )

    if not response.ok:
        raise RuntimeError(f"Groq Error: {response.status_code}: {response.text}")

    result = response.json()
    content = (result.get("choices") or [{}])[0].get("message", {}).get("content", "")
    return parse_json_loosely(content)


def groq_text_prompt(prompt, groq_key, model=None, temperature=0.3, system_prompt=None):
    key = require_key(groq_key, "Groq")
    model = model or DEFAULT_GROQ_MODEL
    system_prompt = system_prompt or "Voce e um assistente especialista em garantia de qualidade de software."

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": str(prompt or "")},
        ],
        "temperature": temperature,
    }

    response = requests.post(
        f"{GROQ_BASE_URL}/chat/completions",
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {key}"},
        json=payload,
        timeout=90,
    )

    if not response.ok:
        raise RuntimeError(f"Groq Error: {response.status_code}: {response.text}")

    result = response.json()
    return (result.get("choices") or [{}])[0].get("message", {}).get("content", "")
