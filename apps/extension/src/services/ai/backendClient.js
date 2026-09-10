// Cliente HTTP generico para o backend QualiFlow (Python/Flask).
// Centraliza chamadas de IA (Gemini/Groq/Copilot) e streaming NDJSON de progresso.

const DEFAULT_BACKEND_URL = "https://qualiflow-gerador-de-cts.onrender.com";

function normalizeBackendUrl(rawValue) {
	const value = String(rawValue || "").trim();
	if (!value) return DEFAULT_BACKEND_URL;

	try {
		const parsed = new URL(value);
		if (!["http:", "https:"].includes(parsed.protocol)) {
			return DEFAULT_BACKEND_URL;
		}
		return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, "");
	} catch {
		return DEFAULT_BACKEND_URL;
	}
}

export function getBackendUrl(settings) {
	return normalizeBackendUrl(settings?.copilotBackendUrl);
}

function getSessionToken(settings) {
	return (settings?.copilotSessionToken || settings?.copilotToken || "").trim();
}

function buildAuthHeaders(settings) {
	const sessionToken = getSessionToken(settings);
	return sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {};
}

// Extrai apenas as credenciais de IA relevantes (nunca envia PAT/tokens de board).
export function buildAiSettingsPayload(settings) {
	return {
		geminiKey: settings?.geminiKey || "",
		geminiModel: settings?.geminiModel || "",
		groqKey: settings?.groqKey || "",
		groqModel: settings?.groqModel || "",
		copilotModel: settings?.copilotModel || ""
	};
}

async function readErrorBody(response) {
	const contentType = response.headers.get("content-type") || "";
	if (contentType.includes("application/json")) {
		try {
			return await response.json();
		} catch {
			return null;
		}
	}
	return null;
}

export async function postJson(path, payload, settings) {
	const backendUrl = getBackendUrl(settings);
	const response = await fetch(`${backendUrl}${path}`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			...buildAuthHeaders(settings)
		},
		body: JSON.stringify(payload)
	});

	const body = await readErrorBody(response);

	if (!response.ok || body?.success === false) {
		const message = body?.error?.message || `Erro no backend (${response.status}).`;
		throw new Error(message);
	}

	return body;
}

// Consome um endpoint que retorna NDJSON (uma linha JSON por vez): eventos de
// progresso ({type:'progress',...}) e um evento final ({type:'result'|'error',...}).
export async function streamScenarios(path, payload, settings, onProgress = () => {}) {
	const backendUrl = getBackendUrl(settings);
	const response = await fetch(`${backendUrl}${path}`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			...buildAuthHeaders(settings)
		},
		body: JSON.stringify(payload)
	});

	if (!response.ok || !response.body) {
		const body = await readErrorBody(response);
		throw new Error(body?.error?.message || `Erro no backend (${response.status}).`);
	}

	const reader = response.body.getReader();
	const decoder = new TextDecoder("utf-8");
	let buffer = "";
	let finalResult = null;
	let finalError = null;

	while (true) {
		const { value, done } = await reader.read();
		if (done) break;

		buffer += decoder.decode(value, { stream: true });
		let newlineIndex = buffer.indexOf("\n");

		while (newlineIndex >= 0) {
			const line = buffer.slice(0, newlineIndex).trim();
			buffer = buffer.slice(newlineIndex + 1);

			if (line) {
				const event = JSON.parse(line);
				if (event.type === "progress") {
					onProgress(event);
				} else if (event.type === "result") {
					finalResult = event.data;
				} else if (event.type === "error") {
					finalError = event.error;
				}
			}

			newlineIndex = buffer.indexOf("\n");
		}
	}

	if (finalError) {
		throw new Error(finalError.message || "Erro ao gerar cenarios no backend.");
	}

	if (!finalResult) {
		throw new Error("Backend nao retornou resultado.");
	}

	return finalResult;
}
