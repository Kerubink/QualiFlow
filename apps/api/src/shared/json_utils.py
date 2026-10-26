"""Parsing tolerante de respostas de LLM que deveriam ser JSON mas vem com ruido (markdown, virgulas sobrando etc.)."""
import json
import re


def strip_markdown_code_fence(text):
    text = text or ""
    text = re.sub(r"^```json\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"^```\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*```$", "", text, flags=re.IGNORECASE)
    return text.strip()


def _try_lenient_json_parse(raw_input):
    if not raw_input or not isinstance(raw_input, str):
        return None

    candidates = []

    normalized = raw_input
    normalized = normalized.replace("\u00a0", " ")
    normalized = re.sub(r"[\u201c\u201d]", '"', normalized)
    normalized = re.sub(r"[\u2018\u2019]", "'", normalized)
    normalized = re.sub(r"^json\s*", "", normalized, flags=re.IGNORECASE)
    normalized = normalized.strip()
    candidates.append(normalized)

    normalized = re.sub(r",\s*([}\]])", r"\1", normalized)
    candidates.append(normalized)

    first_brace = normalized.find("{")
    last_brace = normalized.rfind("}")
    if first_brace >= 0 and last_brace > first_brace:
        between_braces = re.sub(r",\s*([}\]])", r"\1", normalized[first_brace : last_brace + 1])
        candidates.append(between_braces)

    for candidate in candidates:
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            continue

    return None


def parse_json_loosely(text):
    """Extrai um objeto JSON de uma resposta de LLM, tolerando cercas markdown e ruido ao redor."""
    cleaned = strip_markdown_code_fence(text)

    lenient_parsed = _try_lenient_json_parse(cleaned)
    if lenient_parsed is not None:
        return lenient_parsed

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        first_brace = cleaned.find("{")
        last_brace = cleaned.rfind("}")

        if first_brace >= 0 and last_brace > first_brace:
            candidate = cleaned[first_brace : last_brace + 1]
            try:
                return json.loads(candidate)
            except json.JSONDecodeError:
                preview = re.sub(r"\s+", " ", cleaned[:260])
                raise RuntimeError(f"AI_INVALID_JSON_RESPONSE: {preview}")

        preview = re.sub(r"\s+", " ", cleaned[:200])
        raise RuntimeError(f"AI_INVALID_JSON_RESPONSE: {preview}")
