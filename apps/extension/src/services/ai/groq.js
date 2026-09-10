// Proxy fino para o backend QualiFlow: nenhuma chamada direta a api.groq.com.
import { buildAiSettingsPayload, postJson, streamScenarios } from "./backendClient.js";

export async function fetchGroqModels(settings) {
	const body = await postJson("/api/groq/models", { groqKey: settings?.groqKey || "" }, settings);
	return body.models || [];
}

export async function evaluateCoverageGroq(cardData, settings) {
	const body = await postJson(
		"/api/coverage/evaluate",
		{ selectedAi: "groq", cardData, aiSettings: buildAiSettingsPayload(settings) },
		settings
	);
	return body.result || "";
}

// Fallback single-shot (mesma rota usada pela orquestracao completa, sem callback de progresso).
export async function generateScenariosGroq(cardData, userFocus, technicalDetail, generationSettings, settings) {
	return streamScenarios(
		"/api/scenarios/generate",
		{
			selectedAi: "groq",
			cardData,
			userFocus,
			technicalDetail,
			generationSettings,
			aiSettings: buildAiSettingsPayload(settings)
		},
		settings
	);
}

