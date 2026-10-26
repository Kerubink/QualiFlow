// Cliente HTTP para operacoes de board (Azure DevOps / Jira) no backend QualiFlow.
// Azure DevOps aceita login OAuth (Microsoft Entra ID) ou PAT informado pelo usuario; Jira usa
// OAuth Atlassian. Os dois casos passam sempre pelo backend.
import { getBackendUrl } from "../backend/client.js";

function getBoardSessionToken(settings, provider) {
	const key = provider === "jira" ? "jiraSessionToken" : "azureSessionToken";
	return (settings?.[key] || "").trim();
}

export async function callBoardBackend(provider, path, payload, settings) {
	const backendUrl = getBackendUrl(settings);
	const sessionToken = getBoardSessionToken(settings, provider);
	// Azure DevOps: o PAT do usuario tem prioridade sobre a sessao OAuth. Segue so ao backend.
	const azurePat = provider === "azure" ? (settings?.azurePat || "").trim() : "";

	if (!sessionToken && !azurePat) {
		const label = provider === "jira" ? "Jira (Atlassian)" : "Azure DevOps (Microsoft)";
		throw new Error(`Sessao ${label} nao configurada. Faca login nas configuracoes da extensao.`);
	}

	const response = await fetch(`${backendUrl}${path}`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			...(azurePat
				? { "X-Azure-Pat": azurePat }
				: { Authorization: `Bearer ${sessionToken}` })
		},
		body: JSON.stringify(payload)
	});

	const contentType = response.headers.get("content-type") || "";
	const body = contentType.includes("application/json")
		? await response.json()
		: { success: false, error: { message: await response.text() } };

	if (!response.ok || body?.success === false) {
		const message = body?.error?.message || `Erro no backend de board (${response.status}).`;
		throw new Error(message);
	}

	return body;
}
