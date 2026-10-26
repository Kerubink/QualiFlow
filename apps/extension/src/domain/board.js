// Regras de dominio sobre boards (Azure DevOps / Jira).

export const BOARD_AZURE = 'azure';
export const BOARD_JIRA = 'jira';

// Detecta o board a partir do hostname da pagina. Qualquer host desconhecido assume Azure.
export function detectBoardProviderFromHost(hostname) {
    const host = String(hostname || '').toLowerCase();
    if (host.includes('atlassian.net')) return BOARD_JIRA;
    if (host.includes('dev.azure.com') || host.includes('visualstudio.com')) return BOARD_AZURE;
    return BOARD_AZURE;
}

// Provedor explicito do request tem prioridade apenas para Jira; senao usa o board salvo.
export function resolveRequestedBoard(requestedProvider, selectedBoard) {
    if (requestedProvider === BOARD_JIRA) return BOARD_JIRA;
    return selectedBoard === BOARD_JIRA ? BOARD_JIRA : BOARD_AZURE;
}

// Assignee valido no Azure: e-mail ou DOMINIO\usuario.
export function isValidAzureAssignee(value) {
    if (!value) return false;
    const trimmed = value.trim();
    if (!trimmed) return false;

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const domainUserPattern = /^[^\\\s]+\\[^\\\s]+$/;
    return emailPattern.test(trimmed) || domainUserPattern.test(trimmed);
}

// Define o responsavel do cenario: usa o informado se valido; senao o padrao do QA (ou nenhum).
export function resolveScenarioAssignee(rawAssignee, defaultAssignee) {
    const trimmed = typeof rawAssignee === 'string' ? rawAssignee.trim() : undefined;
    if (!trimmed || !isValidAzureAssignee(trimmed)) {
        return defaultAssignee || undefined;
    }
    return trimmed;
}
