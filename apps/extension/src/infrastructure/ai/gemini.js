// Proxy fino para o backend QualiFlow: nenhuma chamada direta a generativelanguage.googleapis.com.
import { buildAiSettingsPayload, postJson } from "../backend/client.js";

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
