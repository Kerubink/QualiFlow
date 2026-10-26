// Proxy fino para o backend QualiFlow: nenhuma chamada direta a api.groq.com.
import { buildAiSettingsPayload, postJson } from "../backend/client.js";

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
