import { RuntimeActions as A, TabMessages } from '../../../contracts/runtimeActions.js';
import { adaptCopiedScenarios, generateScenarios } from '../../../application/scenarioGeneration.js';
import { saveScenarios } from '../../../application/scenarioSaving.js';

// Progresso e enviado a aba que originou o pedido; falhas de entrega sao ignoradas.
function createProgressReporter(deps, sender) {
    return (payload) => {
        const tabId = sender?.tab?.id;
        if (!tabId) return;
        deps.sendMessageToTab(tabId, { action: TabMessages.GENERATION_PROGRESS, ...payload }).catch(() => {
            // Silencioso para nao quebrar fluxo quando aba nao aceita mensagem.
        });
    };
}

export function createScenarioHandlers(deps) {
    return {
        [A.GENERATE_SCENARIOS]: async (request, { sender }) => ({
            scenarios: await generateScenarios(request, deps, createProgressReporter(deps, sender))
        }),
        [A.ADAPT_COPIED_SCENARIOS]: async (request, { sender }) => ({
            scenarios: await adaptCopiedScenarios(request, deps, createProgressReporter(deps, sender))
        }),
        [A.SAVE_SCENARIOS]: (request) => saveScenarios(request, deps)
    };
}
