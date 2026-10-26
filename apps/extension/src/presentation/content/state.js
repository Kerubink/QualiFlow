// Estado compartilhado entre os modulos do content script (um unico objeto mutavel).
// Modulos ES nao compartilham variaveis de topo; leia/escreva sempre via `state.<campo>`.

export const state = {
    currentWorkItemData: null,
    currentScenarios: [],
    currentCoverageData: null,
    currentCopyContext: null,
    // Metadados do dashboard resolvidos pelo carregamento de dados (antes window.qualiflowDashboardMeta).
    dashboardMeta: null
};
