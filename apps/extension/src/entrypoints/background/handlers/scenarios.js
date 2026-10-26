import { RuntimeActions as A, TabMessages } from '../../../contracts/runtimeActions.js';
import { adaptCopiedScenarios, generateScenarios } from '../../../application/scenarioGeneration.js';
import { saveScenarios } from '../../../application/scenarioSaving.js';

// Progresso e enviado a aba que originou o pedido; falhas de entrega sao ignoradas.
function createProgressReporter(deps, sender) {
    return (payload) => {
        const tabId = sender?.tab?.id;
        if (!tabId) return;
        deps.sendMessageToTab(tabId, { action: TabMessages.GENERATION_PROGRESS, ...payload }).catch((err) => {
            // Nao quebra o fluxo quando a aba nao aceita a mensagem, mas deixa rastro para diagnostico.
            console.warn('[QualiFlow] Progresso nao entregue a aba', tabId, err?.message || err);
        });
    };
}

// Geracao pode passar de 30s sem nenhum evento (chamada lenta ao modelo); sem isso o Chrome encerraria o
// service worker por inatividade no meio do stream e o progresso/resultado se perderiam.
const KEEP_ALIVE_INTERVAL_MS = 20000;

async function withServiceWorkerKeepAlive(deps, task) {
    const timer = setInterval(() => {
        Promise.resolve(deps.keepServiceWorkerAlive?.()).catch(() => {});
    }, KEEP_ALIVE_INTERVAL_MS);
    try {
        return await task();
    } finally {
        clearInterval(timer);
    }
}

export function createScenarioHandlers(deps) {
    return {
        [A.GENERATE_SCENARIOS]: async (request, { sender }) => ({
            scenarios: await withServiceWorkerKeepAlive(deps, () =>
                generateScenarios(request, deps, createProgressReporter(deps, sender))
            )
        }),
        [A.ADAPT_COPIED_SCENARIOS]: async (request, { sender }) => ({
            scenarios: await withServiceWorkerKeepAlive(deps, () =>
                adaptCopiedScenarios(request, deps, createProgressReporter(deps, sender))
            )
        }),
        [A.SAVE_SCENARIOS]: (request) => saveScenarios(request, deps)
    };
}
