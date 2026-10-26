"""Parametros `@campo` de um cenario de teste (regra compartilhada entre geracao e boards).

Pura: so le/escreve no dict do cenario, sem I/O.
"""
import re

_PARAM_RE = re.compile(r"@\w+")


def extract_scenario_params(item):
    text_to_scan = f"{item.get('title', '')} {item.get('bdd_description', '')} " + " ".join(
        f"{step.get('action', '')} {step.get('expected', '')}" for step in (item.get("steps") or [])
    )
    seen = []
    for match in _PARAM_RE.findall(text_to_scan):
        if match not in seen:
            seen.append(match)
    return seen


def ensure_scenario_params_default(item):
    param_names = extract_scenario_params(item)
    if not param_names:
        return

    item.setdefault("parameters", {})
    for name in param_names:
        if not (item["parameters"].get(name) or "").strip():
            item["parameters"][name] = "###"
