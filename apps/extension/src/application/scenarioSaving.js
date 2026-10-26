import { BOARD_JIRA, isValidAzureAssignee, resolveRequestedBoard, resolveScenarioAssignee } from '../domain/board.js';
import { ensureScenarioParamsDefault } from '../domain/scenario.js';
import { hasJiraConfig } from '../domain/settingsRules.js';

async function saveToJira(request, settings, jira) {
    try {
        if (!hasJiraConfig(settings)) {
            throw new Error('Configuração Jira incompleta. Verifique login Atlassian, domínio e project key.');
        }
        if (!request.parentData?.id) {
            throw new Error('Issue pai Jira não identificada para vincular os testes.');
        }

        const results = [];
        for (const item of request.scenarios) {
            ensureScenarioParamsDefault(item);
            const res = await jira.jiraCreateTestCase(item, settings, request.parentData?.id);
            results.push({
                id: res.id,
                key: res.key,
                title: item.title,
                action: 'created',
                status: 'success'
            });
        }

        return {
            success: true,
            results,
            message: `${results.length} testes criados com sucesso no Jira.`
        };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

async function saveToAzure(request, settings, azure) {
    const results = [];
    const errors = [];

    const qaEmail = settings.qaEmail?.trim();
    const defaultAssignee = isValidAzureAssignee(qaEmail) ? qaEmail : undefined;
    if (qaEmail && !defaultAssignee) {
        console.warn(`QA email configurado não é um valor Azure válido: ${qaEmail}`);
    }

    // Build map of existing test IDs for validation
    const existingTestIds = request.parentData?.existing_tests?.map(t => t.id) || [];

    for (let idx = 0; idx < request.scenarios.length; idx++) {
        const item = request.scenarios[idx];
        try {
            const assignee = resolveScenarioAssignee(item.assignedTo, defaultAssignee);
            if (assignee) {
                item.assignedTo = assignee;
            } else {
                delete item.assignedTo;
            }
            // Ensure every detected parameter has a default value before saving
            ensureScenarioParamsDefault(item);

            // CRITICAL FIX: id_original should never exist (schema removed it)
            // But if for some reason it exists, validate it against existing tests
            if (item.id_original) {
                if (!existingTestIds.includes(item.id_original)) {
                    throw new Error(
                        `ID ${item.id_original} não encontrado nos testes vinculados. ` +
                        `IDs válidos: [${existingTestIds.join(', ')}]. ` +
                        `Pode ser um erro do Gemini. Nenhum teste foi criado. ` +
                        `Refreshe a página e tente novamente.`
                    );
                }
                // Even if ID is valid, warn and skip (we only want to create new tests)
                console.warn(`Aviso: Ignoring id_original ${item.id_original} for test "${item.title}" (criando novo teste).`);
                item.id_original = undefined;
            }

            // Always create new test case
            const res = await azure.azureCreateTestCase(item, settings, request.parentData);
            results.push({
                id: res.id,
                title: item.title,
                action: 'created',
                status: 'success'
            });
        } catch (err) {
            // Capture error per item, don't break loop
            const errorMsg = err instanceof Error ? err.message : String(err);
            const testLabel = item.title || `Cenário ${idx + 1}`;
            errors.push({ testTitle: testLabel, error: errorMsg, index: idx });
            results.push({
                title: testLabel,
                action: 'failed',
                status: 'error',
                error: errorMsg
            });
        }
    }

    if (errors.length > 0) {
        const errorDetails = errors.map(
            e => `  - "${e.testTitle}" (índice ${e.index}): ${e.error}`
        ).join('\n');
        return {
            success: false,
            results,
            error: `${errors.length}/${request.scenarios.length} testes falharam:\n${errorDetails}\n\nSe o login Microsoft e as permissões estiverem OK, entre em contato com o suporte.`,
            partialSuccess: results.filter(r => r.status === 'success').length > 0
        };
    }

    return {
        success: true,
        results,
        message: `${results.length} testes criados com sucesso no Azure DevOps.`
    };
}

// Cria os cenarios aprovados como Test Cases no board ativo (Azure DevOps ou Jira).
// Sempre cria novos casos; falhas no Azure sao coletadas por item sem interromper o lote.
export async function saveScenarios(request, { getSettings, azure, jira }) {
    const settings = await getSettings();
    const board = resolveRequestedBoard(request.provider, settings.selectedBoard);
    return board === BOARD_JIRA
        ? saveToJira(request, settings, jira)
        : saveToAzure(request, settings, azure);
}
