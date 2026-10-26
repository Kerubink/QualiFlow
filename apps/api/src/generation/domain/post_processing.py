"""Pos-processamento do resultado da IA: normaliza cenarios, garante parametros e recalcula a RTM. Puro (sem I/O)."""
from ...shared.scenario_params import ensure_scenario_params_default
from .criteria import parse_acceptance_criteria
from .deduplication import remove_duplicate_scenarios
from .rtm import compute_rtm
from .scenarios import DEFAULT_TITLE_PREFIX, normalize_scenario


def post_process_generated_scenarios(raw_response, card_data, default_prefix=None):
    if isinstance(raw_response, list):
        source = {"test_cases": raw_response}
    elif isinstance(raw_response, dict):
        source = raw_response
    else:
        source = {"test_cases": []}

    test_cases_raw = source.get("test_cases")
    test_cases_raw = test_cases_raw if isinstance(test_cases_raw, list) else []

    # Deduplica o que a IA devolveu ANTES de normalizar: a normalizacao preenche passos padrao em CTs sem passos, e
    # CTs diferentes ficariam com passos identicos e seriam confundidos com repetidos.
    test_cases_raw, _duplicates = remove_duplicate_scenarios(test_cases_raw)
    test_cases = [normalize_scenario(scenario, idx, default_prefix or DEFAULT_TITLE_PREFIX) for idx, scenario in enumerate(test_cases_raw)]
    for scenario in test_cases:
        ensure_scenario_params_default(scenario)

    acceptance_criteria = parse_acceptance_criteria((card_data or {}).get("acceptance_criteria") or "")
    fallback_criteria = [
        str(row.get("criteria") or "").strip()
        for row in ((source.get("coverage_analysis") or {}).get("rtm_matrix") or [])
        if str(row.get("criteria") or "").strip()
    ]

    criteria_list = acceptance_criteria if acceptance_criteria else fallback_criteria
    rtm = compute_rtm(criteria_list, test_cases)
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
