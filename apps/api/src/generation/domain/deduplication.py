"""Remocao de casos de teste repetidos entre lotes de geracao. Puro (sem I/O).

Como a geracao e feita em lotes independentes, o modelo pode repetir o mesmo cenario (mesmo titulo ou o mesmo
fluxo com outras palavras). Dois CTs sao considerados repetidos quando o titulo normalizado e igual, ou quando
titulo e passos sao muito parecidos, ou quando os passos sao praticamente identicos.
"""
import re
import unicodedata
from difflib import SequenceMatcher

from .scenarios import normalize_title, strip_step_prefix

TITLE_NEAR_RATIO = 0.88
STEPS_NEAR_RATIO = 0.85
STEPS_IDENTICAL_RATIO = 0.95
_MIN_STEPS_TEXT_LEN = 40  # fluxos muito curtos nao sao comparados so pelos passos (evita falso positivo)


def _plain(text):
    decomposed = unicodedata.normalize("NFKD", str(text or ""))
    ascii_text = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    return re.sub(r"[^a-z0-9]+", " ", ascii_text.lower()).strip()


def title_key(title):
    """Titulo sem o prefixo (FUNC/UI/...) e sem acentos/pontuacao, para comparar apenas o contexto."""
    normalized = normalize_title(title, 0, "FUNC")
    _prefix, _sep, context = normalized.partition(" - ")
    return _plain(context or normalized)


def steps_key(scenario):
    steps = scenario.get("steps") if isinstance(scenario, dict) else None
    if isinstance(steps, list) and steps:
        actions = [str((step or {}).get("action") or "") if isinstance(step, dict) else str(step) for step in steps]
    else:
        actions = str((scenario or {}).get("bdd_description") or "").splitlines()
    return _plain(" ".join(strip_step_prefix(action) for action in actions))


def _ratio(a, b):
    return SequenceMatcher(None, a, b).ratio() if a and b else 0.0


def are_duplicates(first, second):
    title_a, title_b = title_key(first.get("title")), title_key(second.get("title"))
    if title_a and title_a == title_b:
        return True

    steps_a, steps_b = steps_key(first), steps_key(second)
    steps_ratio = _ratio(steps_a, steps_b)
    if min(len(steps_a), len(steps_b)) >= _MIN_STEPS_TEXT_LEN and steps_ratio >= STEPS_IDENTICAL_RATIO:
        return True
    return _ratio(title_a, title_b) >= TITLE_NEAR_RATIO and steps_ratio >= STEPS_NEAR_RATIO


def remove_duplicate_scenarios(scenarios):
    """Mantem a primeira ocorrencia de cada cenario. Retorna (unicos, removidos)."""
    unique, removed = [], []
    for scenario in scenarios:
        if not isinstance(scenario, dict):
            unique.append(scenario)
            continue
        if any(isinstance(kept, dict) and are_duplicates(kept, scenario) for kept in unique):
            removed.append(scenario)
        else:
            unique.append(scenario)
    return unique, removed
