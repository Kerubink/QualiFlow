"""Chamadas HTTP diretas aos provedores de IA Gemini e Groq usando a key enviada pela extensao.

A key NUNCA e persistida no backend: trafega apenas na requisicao e e usada para a
chamada ao provedor, descartada ao final do processamento.
"""
import requests

from ..core.json_utils import parse_json_loosely

GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta"
GROQ_BASE_URL = "https://api.groq.com/openai/v1"

DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"
DEFAULT_GROQ_MODEL = "llama3-70b-8192"


def _require_key(key, provider_label):
    value = (key or "").strip()
    if not value:
        raise RuntimeError(f"API Key do {provider_label} nao configurada.")
    return value


def fetch_gemini_models(gemini_key):
    key = _require_key(gemini_key, "Gemini")

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
    key = _require_key(gemini_key, "Gemini")
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
    key = _require_key(gemini_key, "Gemini")
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


def fetch_groq_models(groq_key):
    key = _require_key(groq_key, "Groq")

    response = requests.get(
        f"{GROQ_BASE_URL}/models", headers={"Authorization": f"Bearer {key}"}, timeout=15
    )
    if not response.ok:
        raise RuntimeError(f"Groq Models Error: {response.status_code}: {response.text}")

    result = response.json()
    ids = [item.get("id", "") for item in result.get("data", [])]
    return sorted(id_ for id_ in ids if "whisper" not in id_ and "tool-use" not in id_)


def groq_json_prompt(prompt, groq_key, model=None, temperature=0.2, system_prompt=None):
    key = _require_key(groq_key, "Groq")
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
    key = _require_key(groq_key, "Groq")
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
