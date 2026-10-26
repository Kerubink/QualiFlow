import { normalizeSelectedAi } from '../domain/constants.js';
import { ensureScenarioParamsDefault } from '../domain/scenario.js';
import { postProcessGeneratedScenarios } from '../domain/scenarioPostProcessing.js';

// Roda um fluxo de geracao/adaptacao reportando progresso (start -> postprocess -> done | error).
async function runWithProgress({ startMessage, postprocessMessage, doneMessage, targetCardData, reportProgress, run }) {
    reportProgress({ stage: 'start', message: startMessage });
    try {
        const rawScenarios = await run();
        reportProgress({ stage: 'postprocess', message: postprocessMessage });
        const scenarios = postProcessGeneratedScenarios(rawScenarios, targetCardData, ensureScenarioParamsDefault);
        reportProgress({ stage: 'done', message: doneMessage });
        return scenarios;
    } catch (err) {
        reportProgress({ stage: 'error', message: `Erro: ${err.message}` });
        throw err;
    }
}

// O backend ja faz o fallback para o fluxo legado dentro do mesmo stream; repetir a
// chamada aqui duplicava a geracao (e o consumo de cota) quando ela falhava.
export function generateScenarios(request, { getSettings, scenarioGateway }, reportProgress) {
    return runWithProgress({
        startMessage: 'Iniciando processo de geracao...',
        postprocessMessage: 'Consolidando cenarios e matriz localmente...',
        doneMessage: 'Cenarios prontos para revisao.',
        targetCardData: request.cardData,
        reportProgress,
        run: async () => {
            const settings = await getSettings();
            return scenarioGateway.generateScenarios({
                selectedAi: normalizeSelectedAi(settings.selectedAi),
                settings,
                cardData: request.cardData,
                userFocus: request.userFocus,
                technicalDetail: request.technicalDetail,
                generationSettings: request.generationSettings,
                onProgress: reportProgress
            });
        }
    });
}

export function adaptCopiedScenarios(request, { getSettings, scenarioGateway }, reportProgress) {
    return runWithProgress({
        startMessage: 'Iniciando ajustes automáticos dos CTs copiados...',
        postprocessMessage: 'Consolidando cenários ajustados e RTM...',
        doneMessage: 'Ajustes automáticos concluídos.',
        targetCardData: request.targetCardData,
        reportProgress,
        run: async () => {
            const settings = await getSettings();
            return scenarioGateway.adaptScenarios({
                selectedAi: normalizeSelectedAi(settings.selectedAi),
                settings,
                targetCardData: request.targetCardData,
                sourceWorkItem: {
                    id: request.copyContext?.sourceWorkItemId,
                    title: request.copyContext?.sourceWorkItemTitle
                },
                copiedScenarios: request.copiedScenarios || [],
                userFocus: request.userFocus,
                technicalDetail: request.technicalDetail,
                generationSettings: request.generationSettings,
                onProgress: reportProgress
            });
        }
    });
}
