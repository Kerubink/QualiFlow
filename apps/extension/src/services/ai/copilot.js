import { getBackendUrl } from "./backendClient.js";

function getSessionToken(settings) {
	return (settings.copilotSessionToken || settings.copilotToken || "").trim();
}

function stripMarkdownCodeFence(text) {
	return (text || "")
		.replace(/^```json\s*/i, "")
		.replace(/^```\s*/i, "")
		.replace(/\s*```$/i, "")
		.trim();
}

function parseJsonLoosely(text) {
	const cleaned = stripMarkdownCodeFence(text);
	try {
		return JSON.parse(cleaned);
	} catch {
		const firstBrace = cleaned.indexOf("{");
		const lastBrace = cleaned.lastIndexOf("}");
		if (firstBrace >= 0 && lastBrace > firstBrace) {
			return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
		}
		throw new Error("Copilot retornou JSON invalido.");
	}
}

async function callCopilotBackend(path, options, settings) {
	const backendUrl = getBackendUrl(settings);
	const sessionToken = getSessionToken(settings);

	if (!sessionToken) {
		throw new Error("Session token do Copilot nao configurado. Faca login OAuth no backend.");
	}

	const headers = {
		"Content-Type": "application/json",
		"Authorization": `Bearer ${sessionToken}`,
		...(options?.headers || {})
	};

	const response = await fetch(`${backendUrl}${path}`, {
		method: options?.method || "GET",
		headers,
		body: options?.body
	});

	const contentType = response.headers.get("content-type") || "";
	const body = contentType.includes("application/json")
		? await response.json()
		: { success: false, error: { message: await response.text() } };

	if (!response.ok || body?.success === false) {
		const message = body?.error?.message || `Erro no backend Copilot (${response.status}).`;
		throw new Error(message);
	}

	return body;
}

export async function fetchCopilotModels(settings) {
	const body = await callCopilotBackend("/api/copilot/models", { method: "GET" }, settings);
	return body.models || [];
}

export async function runCopilotJsonPrompt(prompt, settings) {
	const body = await callCopilotBackend(
		"/api/copilot/test",
		{
			method: "POST",
			body: JSON.stringify({ prompt })
		},
		settings
	);

	return parseJsonLoosely(body?.response || "");
}

export async function generateScenariosCopilot(cardData, userFocus, technicalDetail, generationSettings, settings) {
	const payload = {
		cardData,
		userFocus,
		technicalDetail,
		generationSettings,
		model: settings.copilotModel || "claude-sonnet-4.5"
	};

	const body = await callCopilotBackend(
		"/api/copilot/generate",
		{
			method: "POST",
			body: JSON.stringify(payload)
		},
		settings
	);

	const scenarios = body.scenarios;
	if (typeof scenarios === "string") {
		return JSON.parse(stripMarkdownCodeFence(scenarios));
	}

	return scenarios;
}

export async function evaluateCoverageCopilot(cardData, settings) {
	const body = await callCopilotBackend(
		"/api/copilot/evaluate",
		{
			method: "POST",
			body: JSON.stringify({
				cardData,
				model: settings.copilotModel || "claude-sonnet-4.5"
			})
		},
		settings
	);

	return body.result || "";
}
