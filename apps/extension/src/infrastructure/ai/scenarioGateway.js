// Porta de geracao/adaptacao de cenarios: encaminha o pedido ao backend (NDJSON em streaming)
// e repassa os eventos de progresso. Decomposicao, lotes, RTM e pos-processamento rodam no backend.
import { buildAiSettingsPayload, streamScenarios } from '../backend/client.js';

export function generateScenarios({ selectedAi, settings, cardData, userFocus, technicalDetail, generationSettings, onProgress = () => {} }) {
    return streamScenarios(
        '/api/scenarios/generate',
        {
            selectedAi,
            cardData,
            userFocus,
            technicalDetail,
            generationSettings,
            aiSettings: buildAiSettingsPayload(settings)
        },
        settings,
        onProgress
    );
}

export function adaptScenarios({
    selectedAi,
    settings,
    targetCardData,
    sourceWorkItem,
    copiedScenarios,
    userFocus,
    technicalDetail,
    generationSettings,
    onProgress = () => {}
}) {
    return streamScenarios(
        '/api/scenarios/adapt',
        {
            selectedAi,
            targetCardData,
            copyContext: {
                sourceWorkItemId: sourceWorkItem?.id,
                sourceWorkItemTitle: sourceWorkItem?.title
            },
            copiedScenarios: Array.isArray(copiedScenarios) ? copiedScenarios : [],
            userFocus,
            technicalDetail,
            generationSettings,
            aiSettings: buildAiSettingsPayload(settings)
        },
        settings,
        onProgress
    );
}
