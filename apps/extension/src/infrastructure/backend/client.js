// Cliente HTTP generico para o backend QualiFlow (Python/Flask).
// Centraliza chamadas de IA (Gemini/Groq/Copilot) e streaming NDJSON de progresso.

import { normalizeBackendUrl } from "../../domain/backendUrl.js";

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
//
// O progresso tambem e consultado por polling (GET /api/scenarios/progress/<id>): antivirus e proxies
// corporativos podem acumular a resposta em streaming ate o fim, deixando a UI parada. Os dois caminhos
// alimentam o mesmo despachante e o numero sequencial `seq` de cada evento evita repeticoes.
const PROGRESS_POLL_INTERVAL_MS = 1500;

function createProgressDispatcher(onProgress) {
	let lastSeq = 0;
	return {
		get lastSeq() {
			return lastSeq;
		},
		dispatch(event) {
			if (typeof event.seq === "number") {
				if (event.seq <= lastSeq) return;
				lastSeq = event.seq;
			}
			onProgress(event);
		}
	};
}

function startProgressPolling(backendUrl, progressId, settings, progress) {
	let polling = false;
	const timer = setInterval(async () => {
		if (polling) return;
		polling = true;
		try {
			const response = await fetch(
				`${backendUrl}/api/scenarios/progress/${progressId}?after=${progress.lastSeq}`,
				{ headers: buildAuthHeaders(settings) }
			);
			if (!response.ok) return;
			const body = await response.json();
			(body.events || []).forEach((event) => progress.dispatch(event));
		} catch {
			// Polling e so um reforco: o stream continua sendo a fonte do resultado.
		} finally {
			polling = false;
		}
	}, PROGRESS_POLL_INTERVAL_MS);
	return () => clearInterval(timer);
}

export async function streamScenarios(path, payload, settings, onProgress = () => {}) {
	const backendUrl = getBackendUrl(settings);
	const progressId = crypto.randomUUID().replace(/-/g, "");
	const progress = createProgressDispatcher(onProgress);

	// O polling comeca antes dos headers da resposta: um intermediario que acumula o stream tambem segura os
	// headers ate o fim, e o `await fetch` so resolveria quando a geracao ja tivesse terminado.
	const stopPolling = startProgressPolling(backendUrl, progressId, settings, progress);
	try {
		const response = await fetch(`${backendUrl}${path}`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...buildAuthHeaders(settings)
			},
			body: JSON.stringify({ ...payload, progressId })
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
						progress.dispatch(event);
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
	} finally {
		stopPolling();
	}
}
