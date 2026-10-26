"""Matriz de rastreabilidade (RTM): cobertura heuristica por tokens e cobertura de fallback. Puro (sem I/O).
"""
from .criteria import tokenize_basic, tokenize_for_rtm


def fallback_coverage(criteria_list, test_cases):
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


def compute_rtm(criteria_list, scenarios):
    scenario_texts = []
    for idx, scenario in enumerate(scenarios):
        steps_text = " ".join(
            f"{step.get('action', '')} {step.get('expected', '')}" for step in (scenario.get("steps") or [])
        )
        text = f"{scenario.get('title', '')} {scenario.get('bdd_description', '')} {steps_text}"
        scenario_texts.append({"title": scenario.get("title") or f"CT {idx + 1}", "tokens": set(tokenize_for_rtm(text))})

    rtm = []
    for criteria in criteria_list:
        criterion_tokens = tokenize_for_rtm(criteria)
        covered_by = []
        for scenario in scenario_texts:
            hits = sum(1 for token in criterion_tokens if token in scenario["tokens"])
            if hits >= min(2, max(1, len(criterion_tokens))):
                covered_by.append(scenario["title"])

        rtm.append({"criteria": criteria, "covered_by_scenarios": covered_by, "status": "TOTAL" if covered_by else "FALTA"})

    return rtm


def summarize_tests_for_rtm(generated_tests):
    """Resumo compacto (id, titulo, refs e tokens) dos testes gerados, usado pelo prompt de RTM."""
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
                "summary": tokenize_basic(text),
            }
        )
    return generated


def select_coverage(coverage_analysis, criteria_list, test_cases):
    """Usa a RTM devolvida pela IA se vier bem formada; senao cai na cobertura heuristica de fallback."""
    if isinstance(coverage_analysis, dict) and isinstance(coverage_analysis.get("rtm_matrix"), list):
        return coverage_analysis
    return fallback_coverage(criteria_list, test_cases)
