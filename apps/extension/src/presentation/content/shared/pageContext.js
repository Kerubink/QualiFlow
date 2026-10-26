import { detectBoardProviderFromHost } from '../../../domain/board.js';

export function detectBoardProvider() {
    return detectBoardProviderFromHost(window.location.hostname);
}

// Extrai o id do work item da URL atual (Azure: numerico; Jira: chave PROJ-123).
export function extractWorkItemId() {
    const provider = detectBoardProvider();

    if (provider === 'jira') {
        const jiraMatch = window.location.pathname.match(/\/browse\/([A-Z0-9]+-\d+)/i) ||
            window.location.search.match(/[?&]selectedIssue=([A-Z0-9]+-\d+)/i);
        if (jiraMatch && jiraMatch[1]) {
            return jiraMatch[1].toUpperCase();
        }
        return null;
    }

    // Azure DevOps URLs usually look like:
    // https://dev.azure.com/Org/Project/_workitems/edit/12345
    const azureMatch = window.location.href.match(/_workitems\/edit\/(\d+)/) ||
        window.location.href.match(/[?&]id=(\d+)/) ||
        window.location.href.match(/[?&]workitem=(\d+)/);
    if (azureMatch && azureMatch[1]) {
        return azureMatch[1];
    }
    return null;
}
