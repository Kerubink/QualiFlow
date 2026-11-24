/* Selecao de CTs antes de iniciar (ou reiniciar) uma execucao. Modulo PURO. */

export function selectAllIds(testCases) {
    return new Set(testCases.map((t) => t.id));
}

export function toggleId(selected, id) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
}

/** Mantem a ordem original dos CTs. */
export function filterSelected(testCases, selected) {
    return testCases.filter((t) => selected.has(t.id));
}

/** IDs dos CTs reprovados na execucao (para re-executar so os que falharam). */
export function failedIds(testCases, finalOutcomes = {}) {
    return new Set(testCases.filter((t) => finalOutcomes[t.id] === 'Failed').map((t) => t.id));
}
