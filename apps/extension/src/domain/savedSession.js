// Sessoes locais de revisao (persistidas em `qualiflowSavedSessions`).

// Monta a sessao a salvar. Mantem coverageData apontando para os cenarios mais recentes.
export function buildSavedSession({ workItem, scenarios, coverageData, copyContext }, now = Date.now()) {
    if (coverageData) {
        coverageData.test_cases = scenarios;
    }
    return {
        timestamp: now,
        workItem,
        scenariosData: scenarios,
        coverageData,
        copyContext
    };
}

// Reconstroi o estado de revisao a partir de uma sessao salva.
export function restoreSavedSession(session) {
    const scenarios = session.scenariosData;
    const coverageData = session.coverageData || session.scenariosData;
    if (coverageData && coverageData.test_cases) {
        coverageData.test_cases = scenarios;
    }
    return {
        workItem: session.workItem,
        scenarios,
        coverageData,
        copyContext: session.copyContext || null
    };
}

export function removeSession(sessions, id) {
    const next = { ...sessions };
    delete next[id];
    return next;
}
