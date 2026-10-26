import { normalizeSelectedAi } from '../domain/constants.js';
import { BOARD_JIRA, resolveRequestedBoard } from '../domain/board.js';
import { hasAiConfig, hasAzureConfig, hasJiraConfig } from '../domain/settingsRules.js';

// Carrega o work item (Azure) ou issue (Jira) do card aberto, validando antes que IA e board estao configurados.
export async function getCardData({ workId, provider }, { getSettings, azure, jira }) {
    const settings = await getSettings();
    const selectedAi = normalizeSelectedAi(settings.selectedAi);
    const board = resolveRequestedBoard(provider, settings.selectedBoard);

    if (!hasAiConfig(settings, selectedAi)) {
        throw new Error('Configurações ausentes. Por favor, configure a extensão primeiro.');
    }

    if (board === BOARD_JIRA) {
        if (!hasJiraConfig(settings)) {
            throw new Error('Configuração Jira incompleta. Faça login com Atlassian e preencha domínio e project key.');
        }
        return jira.jiraGetIssue(workId, settings);
    }

    if (!hasAzureConfig(settings)) {
        throw new Error('Configuração Azure incompleta. Faça login com Microsoft e selecione organização e projeto.');
    }
    return azure.azureGetWorkItem(workId, settings);
}
