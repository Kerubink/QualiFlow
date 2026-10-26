import { getBackendUrl } from "../backend/client.js";

function getSessionToken(settings) {
	return (settings.copilotSessionToken || settings.copilotToken || "").trim();
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
