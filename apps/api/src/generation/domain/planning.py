"""Plano de geracao: prefixos por tipo de teste, plano de fallback e divisao em lotes. Puro (sem I/O).
"""

PREFIX_BY_TYPE = {
    "Functional": "FUNC",
    "UI/UX": "UI",
    "Security": "SEG",
    "API": "INT",
    "Performance/Load": "PERF",
    "Accessibility": "ACC",
    "Regression": "FUNC",
}


def prefix_for_type(test_type):
    return PREFIX_BY_TYPE.get(test_type or "Functional", "FUNC")


def fallback_test_plan(criteria_list, generation_settings):
    generation_settings = generation_settings or {}
    test_type = generation_settings.get("type") or "Functional"
    prefix = PREFIX_BY_TYPE.get(test_type, "FUNC")

    plan = []
    for idx, criteria in enumerate(criteria_list[:8]):
        plan.append(
            {
                "id": f"CT{idx + 1:02d}",
                "title": f"{prefix} - Validar {criteria[:70]}",
                "type": test_type,
                "prefix": prefix,
                "objective": f"Validar criterio: {criteria}",
                "acceptance_refs": [f"CA{idx + 1}"],
            }
        )
    return plan


def split_in_chunks(items, chunk_size):
    return [items[i : i + chunk_size] for i in range(0, len(items), chunk_size)]


def resolve_chunk_size(raw_chunk_size):
    """Tamanho do lote de geracao: inteiro entre 1 e 5 (padrao 3 se ausente/invalido)."""
    try:
        return max(1, min(5, int(raw_chunk_size)))
    except (TypeError, ValueError):
        return 3
