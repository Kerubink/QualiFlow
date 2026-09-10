// Proxy fino para o backend QualiFlow: nenhuma chamada direta a generativelanguage.googleapis.com.
import { buildAiSettingsPayload, postJson, streamScenarios } from "./backendClient.js";

export async function fetchGeminiModels(settings) {
	const body = await postJson("/api/gemini/models", { geminiKey: settings?.geminiKey || "" }, settings);
	return body.models || [];
}

export async function evaluateCoverageGemini(cardData, settings) {
	const body = await postJson(
		"/api/coverage/evaluate",
		{ selectedAi: "gemini", cardData, aiSettings: buildAiSettingsPayload(settings) },
		settings
	);
	return body.result || "";
}

// Fallback single-shot (mesma rota usada pela orquestracao completa, sem callback de progresso).
export async function generateScenariosGemini(cardData, userFocus, technicalDetail, generationSettings, settings) {
	return streamScenarios(
		"/api/scenarios/generate",
		{
			selectedAi: "gemini",
			cardData,
			userFocus,
			technicalDetail,
			generationSettings,
			aiSettings: buildAiSettingsPayload(settings)
		},
		settings
	);
}

