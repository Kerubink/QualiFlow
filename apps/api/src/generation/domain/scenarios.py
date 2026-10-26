"""Normalizacao de cenarios BDD: prefixos DADO/E/QUANDO/ENTAO, quantidade de passos e descricao Gherkin. Puro (sem I/O).
"""
import re

# Palavra-chave Gherkin no inicio do passo. \b evita cortar palavras comuns ("Exibe", "Dados");
# "E-mail" nao casa porque so ':' ',' '.' ou espaco podem seguir a palavra-chave.
STEP_PREFIX_RE = re.compile(r"^\s*(?:DADO|QUANDO|ENT[ÃA]O|E)\b(?:\s*[:,.]\s*|\s+)", re.IGNORECASE)
# Prefixo no inicio do titulo: "[PERF] - x" (legado/IA) ou "PERF - x". Sem colchetes, so casa com separador explicito.
TITLE_PREFIX_RE = re.compile(r"^\s*(?:\[\s*([A-Za-z]{2,10})\s*\]\s*[-–:]?|([A-Za-z]{2,10})\s*[-–:])\s*")
TITLE_TEMPLATE_PREFIXES = {"PREFIXO", "PREFIX"}
VALID_TITLE_PREFIXES = {"UI", "FUNC", "UX", "ACC", "INT", "SCHEMA", "SEG", "PERF"}
DEFAULT_TITLE_PREFIX = "FUNC"
QUANDO_RE = re.compile(r"^\s*QUANDO\b", re.IGNORECASE)
ACTION_MATCH_RE = re.compile(r"^\s*(DADO|E|QUANDO|ENTAO|ENT[ÃA]O)\b\s*(.*)$", re.IGNORECASE | re.DOTALL)


def normalize_prefix(prefix):
    upper = (prefix or "").upper()
    if upper in ("ENTAO", "ENTÃO"):
        return "ENTAO"
    return upper


def strip_step_prefix(text):
    """Remove TODAS as palavras-chave Gherkin iniciais ("E ENTAO ..." -> "..."), nao so a primeira."""
    clean = str(text or "").strip()
    while True:
        stripped = STEP_PREFIX_RE.sub("", clean, count=1).strip()
        if stripped == clean:
            return clean
        clean = stripped


def normalize_title(title, index, default_prefix=DEFAULT_TITLE_PREFIX):
    """Garante o formato "PREFIXO - Contexto" (sem colchetes) em todos os titulos, sem prefixo duplicado ou literal."""
    clean = str(title or "").strip()
    prefix = ""
    while True:
        match = TITLE_PREFIX_RE.match(clean)
        if not match:
            break
        candidate = (match.group(1) or match.group(2)).upper()
        # Sem colchetes, so consome palavras que sao prefixos reais ("Login - x" continua sendo titulo).
        if match.group(2) and candidate not in VALID_TITLE_PREFIXES and candidate not in TITLE_TEMPLATE_PREFIXES:
            break
        if not prefix and candidate not in TITLE_TEMPLATE_PREFIXES:
            prefix = candidate
        clean = clean[match.end():].strip()
    clean = clean.lstrip("-–: ").strip() or f"CT {index + 1}"
    if prefix not in VALID_TITLE_PREFIXES:
        prefix = default_prefix if default_prefix in VALID_TITLE_PREFIXES else DEFAULT_TITLE_PREFIX
    return f"{prefix} - {clean}"


def ensure_prefixed_action(text, prefix):
    clean = str(text or "").strip()
    without_prefix = strip_step_prefix(clean)
    return f"{prefix} {without_prefix or 'acao a detalhar'}".strip()


DEFAULT_STEPS = [
    {"action": "DADO pre-condicoes e dados de entrada validos", "expected": "Ambiente pronto para execucao", "needs_evidence": False},
    {"action": "E usuario autenticado com perfil adequado", "expected": "Permissoes aplicadas", "needs_evidence": False},
    {"action": "QUANDO executa o fluxo principal da funcionalidade", "expected": "Acao processada sem erro", "needs_evidence": True},
    {"action": "ENTAO resultado principal e apresentado corretamente", "expected": "Comportamento conforme regra", "needs_evidence": True},
    {"action": "E campos derivados sao persistidos", "expected": "Dados salvos de forma consistente", "needs_evidence": False},
    {"action": "E logs e mensagens finais estao corretos", "expected": "Evidencias disponiveis para auditoria", "needs_evidence": False},
]


def normalize_steps(raw_steps):
    steps = []
    for step in raw_steps or []:
        action = str((step or {}).get("action") or "").strip()
        expected = str((step or {}).get("expected") or "").strip()
        if action or expected:
            steps.append({"action": action, "expected": expected, "needs_evidence": bool((step or {}).get("needs_evidence"))})

    if not steps:
        steps = [dict(step) for step in DEFAULT_STEPS]

    while len(steps) < 6:
        insert_at = max(1, len(steps) - 1)
        steps.insert(
            insert_at,
            {"action": "E validar etapa intermediaria do processo", "expected": "Etapa intermediaria concluida com sucesso", "needs_evidence": False},
        )

    max_steps = 10
    if len(steps) > max_steps:
        steps = steps[:max_steps]

    quando_index = next((i for i, step in enumerate(steps) if QUANDO_RE.match(step["action"])), -1)
    if quando_index < 0:
        quando_index = min(max(2, len(steps) - 3), len(steps) - 2)

    for i, step in enumerate(steps):
        if i == 0:
            step["action"] = ensure_prefixed_action(step["action"], "DADO")
        elif i == quando_index:
            step["action"] = ensure_prefixed_action(step["action"], "QUANDO")
        elif i == quando_index + 1:
            step["action"] = ensure_prefixed_action(step["action"], "ENTAO")
        else:
            step["action"] = ensure_prefixed_action(step["action"], "E")

    return steps


def build_bdd_description(steps):
    lines = []
    for step in steps[: min(6, len(steps))]:
        match = ACTION_MATCH_RE.match(step.get("action") or "")
        prefix = normalize_prefix(match.group(1) if match else "E")
        body = (match.group(2) if match else step.get("action") or "acao a detalhar").strip() or "acao a detalhar"
        lines.append(f"{prefix} {body}".strip())
    return "\n".join(lines)


def normalize_scenario(scenario, index, default_prefix=DEFAULT_TITLE_PREFIX):
    steps = normalize_steps(scenario.get("steps"))
    return {
        **scenario,
        "title": normalize_title(scenario.get("title"), index, default_prefix),
        "bdd_description": build_bdd_description(steps),
        "steps": steps,
        "parameters": scenario.get("parameters") if isinstance(scenario.get("parameters"), dict) else {},
    }


def compact_scenarios_for_adaptation(copied_scenarios):
    """Versao compacta dos cenarios copiados, enviada ao prompt de adaptacao."""
    compact_scenarios = []
    for idx, scenario in enumerate(copied_scenarios):
        compact_scenarios.append(
            {
                "id": scenario.get("id_original") or f"SRC_{idx + 1}",
                "title": scenario.get("title") or f"CT {idx + 1}",
                "bdd_description": scenario.get("bdd_description") or "",
                "steps": [
                    {
                        "action": step.get("action", ""),
                        "expected": step.get("expected", ""),
                        "needs_evidence": bool(step.get("needs_evidence")),
                    }
                    for step in (scenario.get("steps") or [])
                ],
                "parameters": scenario.get("parameters") or {},
            }
        )
    return compact_scenarios
