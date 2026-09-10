// A decomposicao/geracao em lotes/RTM e o pos-processamento agora rodam inteiramente no
// backend Python (src/orchestration.py). A extensao apenas envia o pedido e repassa os
// eventos de progresso (NDJSON) recebidos do backend.
import { buildAiSettingsPayload, streamScenarios } from '../ai/backendClient.js';

export async function orchestrateScenarioGeneration({
	selectedAi,
	settings,
	cardData,
	userFocus,
	technicalDetail,
	generationSettings,
	onProgress = () => {}
}) {
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

export async function orchestrateScenarioAdaptation({
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

