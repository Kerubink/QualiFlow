"""
Orquestracao de geracao de cenarios de teste (decomposicao -> lotes -> RTM) e
pos-processamento (normalizacao de steps/BDD, RTM heuristico).

Portado do frontend (services/orchestration/testGeneration.js + postProcessor.js) para
centralizar no backend toda a logica de prompt engineering e regras de negocio.
"""
import json
import re
import unicodedata

from .providers import gemini_json_prompt, gemini_text_prompt, groq_json_prompt, groq_text_prompt
from .copilot import classify_copilot_error, send_prompt_to_copilot
from ..core.json_utils import parse_json_loosely

PREFIX_BY_TYPE = {
    "Functional": "FUNC",
    "UI/UX": "UI",
    "Security": "SEG",
    "API": "INT",
    "Performance/Load": "PERF",
    "Accessibility": "ACC",
    "Regression": "FUNC",
}


def _strip_html(raw_input):
    text = str(raw_input or "")
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<li[^>]*>", "\n- ", text, flags=re.IGNORECASE)
    text = re.sub(r"</li>", "", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"&nbsp;", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"&amp;", "&", text, flags=re.IGNORECASE)
    text = re.sub(r"&lt;", "<", text, flags=re.IGNORECASE)
    text = re.sub(r"&gt;", ">", text, flags=re.IGNORECASE)
    text = text.replace("\r", "")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _tokenize_basic(text):
    normalized = unicodedata.normalize("NFD", str(text or "").lower())
    normalized = "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")
    normalized = re.sub(r"[^a-z0-9\s]", " ", normalized)
    normalized = re.sub(r"\s+", " ", normalized).strip()
    return normalized


_RTM_STOPWORDS = {
    "para", "com", "sem", "dos", "das", "que", "uma", "como", "deve", "dever", "quando",
    "entao", "dado", "este", "esta", "pelo", "pela", "sobre", "entre", "apos", "antes",
}


def _tokenize_for_rtm(text):
    clean = _tokenize_basic(text)
    return [word for word in clean.split(" ") if len(word) >= 4 and word not in _RTM_STOPWORDS]


def _parse_criteria_lines(text, min_length):
    plain = _strip_html(text)
    lines = [line.strip() for line in plain.split("\n") if line.strip()]
    lines = [re.sub(r"^[-*]\s*", "", line) for line in lines]

    criteria = []
    for line in lines:
        numbered = re.match(r"^\d+[.)]\s+", line)
        if numbered:
            criteria.append(re.sub(r"^\d+[.)]\s+", "", line).strip())
            continue
        if len(line) > min_length:
            criteria.append(line)

    seen = set()
    unique = []
    for item in criteria:
        if item not in seen:
            seen.add(item)
            unique.append(item)
    return unique[:40]


def parse_acceptance_criteria(acceptance_criteria):
    return _parse_criteria_lines(acceptance_criteria, min_length=14)


def split_acceptance_criteria(acceptance_criteria):
    return _parse_criteria_lines(acceptance_criteria, min_length=14)


def _split_in_chunks(items, chunk_size):
    return [items[i : i + chunk_size] for i in range(0, len(items), chunk_size)]


def provider_json_prompt(selected_ai, ai_settings, prompt, temperature=0.2, github_token=None):
    ai_settings = ai_settings or {}

    if selected_ai == "groq":
        return groq_json_prompt(prompt, ai_settings.get("groqKey"), ai_settings.get("groqModel"), temperature)

    if selected_ai == "copilot":
        raw = send_prompt_to_copilot(
            prompt, github_token=github_token, preferred_model=ai_settings.get("copilotModel")
        )
        return parse_json_loosely(raw)

    return gemini_json_prompt(prompt, ai_settings.get("geminiKey"), ai_settings.get("geminiModel"), temperature)


def provider_text_prompt(selected_ai, ai_settings, prompt, temperature=0.3, github_token=None):
    ai_settings = ai_settings or {}

    if selected_ai == "groq":
        return groq_text_prompt(prompt, ai_settings.get("groqKey"), ai_settings.get("groqModel"), temperature)

    if selected_ai == "copilot":
        return send_prompt_to_copilot(
            prompt, github_token=github_token, preferred_model=ai_settings.get("copilotModel")
        )

    return gemini_text_prompt(prompt, ai_settings.get("geminiKey"), ai_settings.get("geminiModel"), temperature)


def _build_decomposition_prompt(card_data, user_focus, technical_detail, generation_settings, criteria_list):
    card_data = card_data or {}
    payload = {
        "stage": "decomposition",
        "objective": "Atue como Arquiteto de Testes e decompose a historia em plano de testes enxuto.",
        "constraints": [
            "Retorne apenas JSON valido.",
            "Nao gere steps nesta etapa.",
            "Cada item de test_plan deve conter: id, title, type, prefix, objective, acceptance_refs.",
        ],
        "generation_settings": generation_settings,
        "work_item": {
            "id": card_data.get("id"),
            "title": card_data.get("title"),
            "description": _strip_html(card_data.get("description") or ""),
            "acceptance_criteria": criteria_list,
            "tags": card_data.get("tags") or "",
        },
        "user_focus": user_focus or "",
        "technical_detail": technical_detail or "",
        "output_schema": {
            "rules": ["string"],
            "test_plan": [
                {
                    "id": "CT01",
                    "title": "[PREFIXO] - Titulo do caso",
                    "type": "Functional|UI/UX|Security|API|Performance/Load|Accessibility|Regression",
                    "prefix": "UI|FUNC|SEG|PERF|INT|ACC|SCHEMA|UX",
                    "objective": "Objetivo do teste",
                    "acceptance_refs": ["CA1", "CA2"],
                }
            ],
        },
    }
    return json.dumps(payload, ensure_ascii=False)


def _build_batch_prompt(card_data, criteria_list, rules, batch_plan, generation_settings, user_focus, technical_detail):
    card_data = card_data or {}
    payload = {
        "stage": "batch-generation",
        "objective": "Gerar detalhes BDD completos para o lote de casos de teste informado.",
        "constraints": [
            'Retorne apenas JSON valido no formato {"test_cases": [...]}',
            "Gerar de 6 a 10 steps por caso",
            "Exatamente um step iniciando com QUANDO",
            "Demais steps com DADO/E/ENTAO",
            "Mapear needs_evidence por step",
            "Mapear parameters usando @campo quando aplicavel",
        ],
        "rules": rules,
        "generation_settings": generation_settings,
        "work_item": {
            "id": card_data.get("id"),
            "title": card_data.get("title"),
            "description": _strip_html(card_data.get("description") or ""),
            "acceptance_criteria": criteria_list,
            "tags": card_data.get("tags") or "",
        },
        "user_focus": user_focus or "",
        "technical_detail": technical_detail or "",
        "batch_plan": batch_plan,
        "output_schema": {
            "test_cases": [
                {
                    "id": "CT01",
                    "title": "[PREFIXO] - Titulo",
                    "bdd_description": "DADO ...\\nE ...\\nQUANDO ...\\nENTAO ...",
                    "steps": [
                        {"action": "DADO ...", "expected": "...", "needs_evidence": False},
                        {"action": "QUANDO ...", "expected": "...", "needs_evidence": True},
                    ],
                    "parameters": {"@campo": "valor"},
                    "acceptance_refs": ["CA1"],
                }
            ]
        },
    }
    return json.dumps(payload, ensure_ascii=False)


def _build_rtm_prompt(criteria_list, generated_tests):
    generated = []
    for idx, test in enumerate(generated_tests):
        text = f"{test.get('title', '')} {test.get('bdd_description', '')} " + " ".join(
            f"{step.get('action', '')} {step.get('expected', '')}" for step in (test.get("steps") or [])
        )
        generated.append(
            {
                "id": test.get("id") or f"CT{idx + 1}",
                "title": test.get("title") or f"CT {idx + 1}",
                "acceptance_refs": test.get("acceptance_refs") or [],
                "summary": _tokenize_basic(text),
            }
        )

    payload = {
        "stage": "rtm",
        "objective": "Cruzar criterios de aceite com casos de teste gerados e retornar matriz RTM.",
        "constraints": [
            "Retorne apenas JSON valido.",
            "Cada criterio precisa de covered_by_scenarios com titulos dos CTs.",
            "Status: TOTAL quando houver cobertura, FALTA quando nao houver.",
        ],
        "criteria": criteria_list,
        "generated_tests": generated,
        "output_schema": {
            "coverage_analysis": {
                "rtm_matrix": [{"criteria": "criterio", "covered_by_scenarios": ["CT title"], "status": "TOTAL|FALTA"}],
                "insights": "Resumo qualitativo",
                "coverage_score": "0-100%",
            }
        },
    }
    return json.dumps(payload, ensure_ascii=False)


def _build_adaptation_prompt(
    target_card_data, source_work_item, copied_scenarios, criteria_list, generation_settings, user_focus, technical_detail
):
    target_card_data = target_card_data or {}
    source_work_item = source_work_item or {}

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

    payload = {
        "stage": "copied-scenarios-adaptation",
        "objective": "Adaptar casos de teste copiados para o novo card alvo, preservando estrutura e ajustando cobertura.",
        "constraints": [
            "Retorne apenas JSON valido.",
            "Mantenha entre 6 e 10 passos por caso.",
            "Cada passo action deve iniciar com DADO, E, QUANDO ou ENTAO.",
            "Cada cenario deve ter exatamente um passo iniciando com QUANDO.",
            "Atualize titulos e passos para refletir o card alvo e seus criterios.",
            "Priorize reaproveitamento inteligente ao inves de reescrever tudo do zero.",
        ],
        "generation_settings": generation_settings,
        "source_context": {
            "work_item_id": source_work_item.get("id"),
            "work_item_title": source_work_item.get("title") or "",
            "copied_test_cases": compact_scenarios,
        },
        "target_context": {
            "id": target_card_data.get("id"),
            "title": target_card_data.get("title"),
            "description": _strip_html(target_card_data.get("description") or ""),
            "acceptance_criteria": criteria_list,
            "tags": target_card_data.get("tags") or "",
        },
        "user_focus": user_focus or "",
        "technical_detail": technical_detail or "",
        "output_schema": {
            "test_cases": [
                {
                    "title": "[PREFIXO] - Titulo ajustado ao card alvo",
                    "bdd_description": "DADO ...\\nQUANDO ...\\nENTAO ...",
                    "steps": [
                        {"action": "DADO ...", "expected": "...", "needs_evidence": False},
                        {"action": "QUANDO ...", "expected": "...", "needs_evidence": True},
                    ],
                    "parameters": {"@campo": "valor"},
                    "acceptance_refs": ["CA1", "CA2"],
                }
            ]
        },
    }
    return json.dumps(payload, ensure_ascii=False)


def _fallback_test_plan(criteria_list, generation_settings):
    generation_settings = generation_settings or {}
    test_type = generation_settings.get("type") or "Functional"
    prefix = PREFIX_BY_TYPE.get(test_type, "FUNC")

    plan = []
    for idx, criteria in enumerate(criteria_list[:8]):
        plan.append(
            {
                "id": f"CT{idx + 1:02d}",
                "title": f"[{prefix}] - Validar {criteria[:70]}",
                "type": test_type,
                "prefix": prefix,
                "objective": f"Validar criterio: {criteria}",
                "acceptance_refs": [f"CA{idx + 1}"],
            }
        )
    return plan


def _fallback_coverage(criteria_list, test_cases):
    test_titles = [test.get("title") or f"CT {idx + 1}" for idx, test in enumerate(test_cases)]
    matrix = []
    for idx, criteria in enumerate(criteria_list):
        covered = [test_titles[idx % len(test_titles)]] if test_titles else []
        matrix.append({"criteria": criteria, "covered_by_scenarios": covered, "status": "TOTAL" if covered else "FALTA"})

    covered_count = sum(1 for row in matrix if row["covered_by_scenarios"])
    score = round((covered_count / len(matrix)) * 100) if matrix else 0

    return {
        "rtm_matrix": matrix,
        "insights": f"Cobertura consolidada com {len(test_titles)} teste(s) para {len(criteria_list)} criterio(s).",
        "coverage_score": f"{score}%",
    }


def orchestrate_scenario_generation(
    selected_ai, ai_settings, card_data, user_focus, technical_detail, generation_settings, github_token=None
):
    """Generator: yields ('progress', dict) durante o processo e ('result', dict) ao final."""
    yield "progress", {"stage": "analyzing", "message": "Analisando regras e decompondo os cenarios..."}
    criteria_list = parse_acceptance_criteria((card_data or {}).get("acceptance_criteria") or "")

    decomposition_prompt = _build_decomposition_prompt(
        card_data, user_focus, technical_detail, generation_settings, criteria_list
    )

    try:
        decomposition = provider_json_prompt(selected_ai, ai_settings, decomposition_prompt, 0.1, github_token)
    except Exception:
        decomposition = None

    rules = (decomposition or {}).get("rules") if isinstance(decomposition, dict) else None
    rules = rules if isinstance(rules, list) else []

    test_plan = (decomposition or {}).get("test_plan") if isinstance(decomposition, dict) else None
    if not isinstance(test_plan, list) or not test_plan:
        test_plan = _fallback_test_plan(criteria_list, generation_settings)

    chunk_size_raw = (ai_settings or {}).get("generationChunkSize")
    try:
        chunk_size = max(1, min(5, int(chunk_size_raw)))
    except (TypeError, ValueError):
        chunk_size = 3

    batches = _split_in_chunks(test_plan, chunk_size)
    generated_tests = []

    yield "progress", {
        "stage": "batch-start",
        "message": "Gerando cenarios de teste em lotes...",
        "totalBatches": len(batches),
    }

    for batch_index, batch_plan in enumerate(batches):
        yield "progress", {
            "stage": "batch-progress",
            "message": f"Gerando lote {batch_index + 1} de {len(batches)}...",
            "batchIndex": batch_index + 1,
            "totalBatches": len(batches),
        }

        batch_prompt = _build_batch_prompt(
            card_data, criteria_list, rules, batch_plan, generation_settings, user_focus, technical_detail
        )
        batch_result = provider_json_prompt(selected_ai, ai_settings, batch_prompt, 0.2, github_token)
        batch_cases = batch_result.get("test_cases") if isinstance(batch_result, dict) else None
        generated_tests.extend(batch_cases if isinstance(batch_cases, list) else [])

    if not generated_tests:
        raise RuntimeError("Nao foi possivel gerar casos de teste no lote.")

    yield "progress", {"stage": "rtm", "message": "Montando matriz RTM e analise de cobertura..."}
    coverage_analysis = None
    try:
        rtm_prompt = _build_rtm_prompt(criteria_list, generated_tests)
        rtm_result = provider_json_prompt(selected_ai, ai_settings, rtm_prompt, 0.1, github_token)
        coverage_analysis = rtm_result.get("coverage_analysis") if isinstance(rtm_result, dict) else None
    except Exception:
        coverage_analysis = None

    final_coverage = (
        coverage_analysis
        if isinstance(coverage_analysis, dict) and isinstance(coverage_analysis.get("rtm_matrix"), list)
        else _fallback_coverage(criteria_list, generated_tests)
    )

    yield "progress", {"stage": "done", "message": "Geracao concluida com sucesso."}

    yield "result", {
        "total_criterios": len(criteria_list) or len(final_coverage["rtm_matrix"]),
        "total_tests": len(generated_tests),
        "coverage_analysis": final_coverage,
        "test_cases": generated_tests,
    }


def orchestrate_scenario_adaptation(
    selected_ai,
    ai_settings,
    target_card_data,
    source_work_item,
    copied_scenarios,
    user_focus,
    technical_detail,
    generation_settings,
    github_token=None,
):
    criteria_list = parse_acceptance_criteria((target_card_data or {}).get("acceptance_criteria") or "")
    normalized_copied = copied_scenarios if isinstance(copied_scenarios, list) else []

    if not normalized_copied:
        raise RuntimeError("Nao ha cenarios copiados para ajustar.")

    yield "progress", {"stage": "analyzing", "message": "Analisando CTs copiados e criterios do card alvo..."}

    adaptation_prompt = _build_adaptation_prompt(
        target_card_data, source_work_item, normalized_copied, criteria_list, generation_settings, user_focus, technical_detail
    )

    adaptation_result = provider_json_prompt(selected_ai, ai_settings, adaptation_prompt, 0.2, github_token)
    adapted_cases = adaptation_result.get("test_cases") if isinstance(adaptation_result, dict) else None
    adapted_cases = adapted_cases if isinstance(adapted_cases, list) else []

    if not adapted_cases:
        raise RuntimeError("A IA nao retornou cenarios ajustados para o card alvo.")

    yield "progress", {"stage": "rtm", "message": "Montando matriz RTM para validar cobertura apos ajustes..."}

    coverage_analysis = None
    try:
        rtm_prompt = _build_rtm_prompt(criteria_list, adapted_cases)
        rtm_result = provider_json_prompt(selected_ai, ai_settings, rtm_prompt, 0.1, github_token)
        coverage_analysis = rtm_result.get("coverage_analysis") if isinstance(rtm_result, dict) else None
    except Exception:
        coverage_analysis = None

    final_coverage = (
        coverage_analysis
        if isinstance(coverage_analysis, dict) and isinstance(coverage_analysis.get("rtm_matrix"), list)
        else _fallback_coverage(criteria_list, adapted_cases)
    )

    yield "progress", {"stage": "done", "message": "Ajuste concluido com RTM atualizado."}

    yield "result", {
        "total_criterios": len(criteria_list) or len(final_coverage["rtm_matrix"]),
        "total_tests": len(adapted_cases),
        "coverage_analysis": final_coverage,
        "test_cases": adapted_cases,
    }


def _detect_track_from_tags(tags):
    normalized = (tags or "").lower()
    if "frontend" in normalized and "backend" not in normalized:
        return "Frontend"
    if "backend" in normalized and "frontend" not in normalized:
        return "Backend"
    return "Geral (Frontend e Backend)"


def legacy_generate_scenarios(selected_ai, ai_settings, card_data, user_focus, technical_detail, generation_settings, github_token=None):
    """Fallback single-shot (sem decomposicao em lotes), usado quando a orquestracao completa falha."""
    card_data = card_data or {}
    generation_settings = generation_settings or {}

    track = _detect_track_from_tags(card_data.get("tags"))
    objective = generation_settings.get("objective") or "All Objectives"
    test_type = generation_settings.get("type") or "Funcional"
    granularity = generation_settings.get("granularity") or "Detalhado"
    data_level = generation_settings.get("dataLevel") or "Massa de dados basica"

    objective_instruction = (
        "Gere uma suite de testes COMPLETA e ABRANGENTE, cobrindo de forma equilibrada o Fluxo Principal, "
        "Cenarios de Excecao, Casos de Borda e Regras de Negocio Complexas."
        if objective == "All Objectives"
        else f"FOCO NO OBJETIVO: {objective}."
    )

    existing_tests = card_data.get("existing_tests")

    prompt_task = {
        "role": "QA Senior",
        "objective": f"""Aja como QA Senior. Gere ou atualize Casos de Teste em BDD.
CONFIGURACAO DE GERACAO:
- Objetivo: {objective} ({objective_instruction})
- Tipo de Teste: {test_type}
- Estilo de Escrita: {granularity}
- Estrategia de Dados: {data_level}
Forneca metricas de cobertura com resumo qualitativo e score.
Retorne EXATAMENTE UM objeto JSON estrito com o formato especificado.""",
        "test_context": {
            "track": track,
            "focus": f"Foque em {objective}. Tipo de validacao: {test_type}. Estilo: {granularity}. "
            f"Estrategia de dados: {data_level}.",
            "special_instructions": objective_instruction,
        },
        "input_data": {
            "work_item": {
                "id": card_data.get("id"),
                "title": card_data.get("title"),
                "description": card_data.get("description"),
                "acceptance_criteria": card_data.get("acceptance_criteria"),
                "tags": card_data.get("tags"),
            },
            "user_technical_context": user_focus or "Nao informado pelo usuario.",
            "deep_technical_detail": technical_detail or "Nao informado.",
            "legacy_tests_for_upgrade": existing_tests if existing_tests else "Nenhum",
        },
        "formatting_rules": {
            "output_language": "Portugues do Brasil (pt-BR)",
            "gherkin_style": "O campo bdd_description DEVE ter os termos GHERKIN (DADO, QUANDO, ENTAO, E) "
            "no inicio de cada frase, com quebras de linha entre eles.",
            "step_style": "O campo action de CADA PASSO do array de passos DEVE tambem comecar com DADO, E, "
            "QUANDO ou ENTAO. IMPORTANTE: Deve haver EXATAMENTE UM passo comecando com QUANDO.",
            "step_detail": "Cada teste deve ter entre 6 e 10 passos claros.",
            "parameters": "IMPORTANTE: Use parametros explicitos com simbolo @ nos passos sempre que houver "
            "massa de dados dinamica.",
            "evidence": "Se um passo valida estado do sistema, mensagens de erro ou um sucesso critico de "
            "interface, defina needs_evidence: true para esse passo. Caso contrario, false.",
        },
        "expected_json_structure": {
            "total_criterios": 0,
            "total_tests": 0,
            "coverage_analysis": {
                "rtm_matrix": [{"criteria": "criterio", "covered_by_scenarios": ["Titulo do CT"], "status": "TOTAL"}],
                "insights": "Resumo qualitativo",
                "coverage_score": "100%",
            },
            "test_cases": [
                {
                    "title": "[PREFIXO] - Titulo",
                    "bdd_description": "DADO ...\nQUANDO ...\nENTAO ...",
                    "steps": [
                        {"action": "DADO ...", "expected": "...", "needs_evidence": False},
                        {"action": "QUANDO ...", "expected": "...", "needs_evidence": True},
                    ],
                    "parameters": {},
                }
            ],
        },
    }

    prompt = "\n\n".join(
        [
            "Voce e um gerador especialista de testes de software em BDD.",
            "Retorne APENAS um objeto JSON valido correspondente a estrutura esperada.",
            "Nao use markdown e nao use bloco de codigo.",
            json.dumps(prompt_task, ensure_ascii=False),
        ]
    )

    return provider_json_prompt(selected_ai, ai_settings, prompt, 0.2, github_token)


def evaluate_coverage(selected_ai, card_data, ai_settings, github_token=None):
    card_data = card_data or {}
    existing_tests = card_data.get("existing_tests")
    if not existing_tests:
        return "Nao ha testes existentes para avaliar."

    prompt_text = f"""
Voce e um QA Senior.
Analise os Criterios de Aceite da historia abaixo e os Testes Existentes.
Avalie a cobertura. Ela esta boa? Faltam caminhos felizes, cenarios de erro ou validacoes de seguranca?

CRITERIOS DE ACEITE:
{card_data.get("acceptance_criteria")}

TESTES EXISTENTES (JSON):
{json.dumps(existing_tests, ensure_ascii=False)}

Responda em Portugues do Brasil com no maximo 3 paragrafos curtos e diretos, sem markdown pesado.
"""

    return provider_text_prompt(selected_ai, ai_settings, prompt_text, 0.3, github_token)


def classify_ai_error(selected_ai, error):
    normalized = classify_copilot_error(error)
    if selected_ai != "copilot" and normalized["code"] == "COPILOT_REQUEST_ERROR":
        normalized = {**normalized, "code": "AI_REQUEST_ERROR", "message": "Erro ao processar prompt com o provedor de IA."}
    return normalized


# --- Pos-processamento (normalizacao de steps/BDD e RTM heuristico) ---

_STEP_PREFIX_RE = re.compile(r"^\s*(DADO|E|QUANDO|ENTAO|ENT[ÃA]O)\s*[:,.-]?\s*", re.IGNORECASE)
_QUANDO_RE = re.compile(r"^\s*QUANDO\b", re.IGNORECASE)
_ACTION_MATCH_RE = re.compile(r"^\s*(DADO|E|QUANDO|ENTAO|ENT[ÃA]O)\b\s*(.*)$", re.IGNORECASE | re.DOTALL)


def _normalize_prefix(prefix):
    upper = (prefix or "").upper()
    if upper in ("ENTAO", "ENTÃO"):
        return "ENTAO"
    return upper


def _ensure_prefixed_action(text, prefix):
    clean = str(text or "").strip()
    without_prefix = _STEP_PREFIX_RE.sub("", clean).strip()
    return f"{prefix} {without_prefix or 'acao a detalhar'}".strip()


_DEFAULT_STEPS = [
    {"action": "DADO pre-condicoes e dados de entrada validos", "expected": "Ambiente pronto para execucao", "needs_evidence": False},
    {"action": "E usuario autenticado com perfil adequado", "expected": "Permissoes aplicadas", "needs_evidence": False},
    {"action": "QUANDO executa o fluxo principal da funcionalidade", "expected": "Acao processada sem erro", "needs_evidence": True},
    {"action": "ENTAO resultado principal e apresentado corretamente", "expected": "Comportamento conforme regra", "needs_evidence": True},
    {"action": "E campos derivados sao persistidos", "expected": "Dados salvos de forma consistente", "needs_evidence": False},
    {"action": "E logs e mensagens finais estao corretos", "expected": "Evidencias disponiveis para auditoria", "needs_evidence": False},
]


def _normalize_steps(raw_steps):
    steps = []
    for step in raw_steps or []:
        action = str((step or {}).get("action") or "").strip()
        expected = str((step or {}).get("expected") or "").strip()
        if action or expected:
            steps.append({"action": action, "expected": expected, "needs_evidence": bool((step or {}).get("needs_evidence"))})

    if not steps:
        steps = [dict(step) for step in _DEFAULT_STEPS]

    while len(steps) < 6:
        insert_at = max(1, len(steps) - 1)
        steps.insert(
            insert_at,
            {"action": "E validar etapa intermediaria do processo", "expected": "Etapa intermediaria concluida com sucesso", "needs_evidence": False},
        )

    max_steps = 10
    if len(steps) > max_steps:
        steps = steps[:max_steps]

    quando_index = next((i for i, step in enumerate(steps) if _QUANDO_RE.match(step["action"])), -1)
    if quando_index < 0:
        quando_index = min(max(2, len(steps) - 3), len(steps) - 2)

    for i, step in enumerate(steps):
        if i == 0:
            step["action"] = _ensure_prefixed_action(step["action"], "DADO")
        elif i == quando_index:
            step["action"] = _ensure_prefixed_action(step["action"], "QUANDO")
        elif i == quando_index + 1:
            step["action"] = _ensure_prefixed_action(step["action"], "ENTAO")
        else:
            step["action"] = _ensure_prefixed_action(step["action"], "E")

    return steps


def _build_bdd_description(steps):
    lines = []
    for step in steps[: min(6, len(steps))]:
        match = _ACTION_MATCH_RE.match(step.get("action") or "")
        prefix = _normalize_prefix(match.group(1) if match else "E")
        body = (match.group(2) if match else step.get("action") or "acao a detalhar").strip() or "acao a detalhar"
        lines.append(f"{prefix} {body}".strip())
    return "\n".join(lines)


def _compute_rtm(criteria_list, scenarios):
    scenario_texts = []
    for idx, scenario in enumerate(scenarios):
        steps_text = " ".join(
            f"{step.get('action', '')} {step.get('expected', '')}" for step in (scenario.get("steps") or [])
        )
        text = f"{scenario.get('title', '')} {scenario.get('bdd_description', '')} {steps_text}"
        scenario_texts.append({"title": scenario.get("title") or f"CT {idx + 1}", "tokens": set(_tokenize_for_rtm(text))})

    rtm = []
    for criteria in criteria_list:
        criterion_tokens = _tokenize_for_rtm(criteria)
        covered_by = []
        for scenario in scenario_texts:
            hits = sum(1 for token in criterion_tokens if token in scenario["tokens"])
            if hits >= min(2, max(1, len(criterion_tokens))):
                covered_by.append(scenario["title"])

        rtm.append({"criteria": criteria, "covered_by_scenarios": covered_by, "status": "TOTAL" if covered_by else "FALTA"})

    return rtm


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


def _normalize_scenario(scenario, index):
    steps = _normalize_steps(scenario.get("steps"))
    return {
        **scenario,
        "title": str(scenario.get("title") or f"CT {index + 1}").strip(),
        "bdd_description": _build_bdd_description(steps),
        "steps": steps,
        "parameters": scenario.get("parameters") if isinstance(scenario.get("parameters"), dict) else {},
    }


def post_process_generated_scenarios(raw_response, card_data):
    if isinstance(raw_response, list):
        source = {"test_cases": raw_response}
    elif isinstance(raw_response, dict):
        source = raw_response
    else:
        source = {"test_cases": []}

    test_cases_raw = source.get("test_cases")
    test_cases_raw = test_cases_raw if isinstance(test_cases_raw, list) else []

    test_cases = [_normalize_scenario(scenario, idx) for idx, scenario in enumerate(test_cases_raw)]
    for scenario in test_cases:
        ensure_scenario_params_default(scenario)

    acceptance_criteria = split_acceptance_criteria((card_data or {}).get("acceptance_criteria") or "")
    fallback_criteria = [
        str(row.get("criteria") or "").strip()
        for row in ((source.get("coverage_analysis") or {}).get("rtm_matrix") or [])
        if str(row.get("criteria") or "").strip()
    ]

    criteria_list = acceptance_criteria if acceptance_criteria else fallback_criteria
    rtm = _compute_rtm(criteria_list, test_cases)
    covered = sum(1 for row in rtm if row["covered_by_scenarios"])
    total = len(rtm) or 1
    score = round((covered / total) * 100)

    return {
        "total_criterios": len(rtm),
        "total_tests": len(test_cases),
        "coverage_analysis": {
            "rtm_matrix": rtm,
            "insights": f"Cobertura automatica: {covered} de {len(rtm)} criterios com ao menos um CT mapeado.",
            "coverage_score": f"{score}%",
        },
        "test_cases": test_cases,
    }
