// Cliente do fluxo OAuth do backend: inicia a sessao (abre aba de login) e faz polling
// ate receber o sessionToken. Nao persiste nada; a camada de aplicacao decide o que salvar.
async function parseJsonResponse(response) {
    const rawText = await response.text();
    try {
        return rawText ? JSON.parse(rawText) : {};
    } catch {
        const preview = rawText.replace(/\s+/g, ' ').trim().slice(0, 160);
        throw new Error(
            `Backend respondeu ${response.status} sem JSON valido (verifique se a URL do backend esta correta e se ele esta rodando/atualizado). ${preview}`
        );
    }
}

function resolveLoginUrl(loginPath, backendUrl) {
    return new URL(loginPath, `${backendUrl}/`).toString();
}

// Copilot (GitHub): POST /auth/session/start
export async function requestCopilotSession(backendUrl) {
    const response = await fetch(`${backendUrl}/auth/session/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    });
    const body = await parseJsonResponse(response);

    if (!response.ok || body?.success === false || !body?.requestId) {
        throw new Error(body?.error?.message || 'Falha ao iniciar autenticacao OAuth.');
    }

    const loginPath = String(body.loginPath || '/auth/github/login').trim() || '/auth/github/login';
    return {
        requestId: body.requestId,
        pollPath: body.pollPath,
        loginUrl: resolveLoginUrl(loginPath, backendUrl)
    };
}

// Boards (provider: 'microsoft' | 'atlassian'): POST /auth/board/session/start
export async function requestBoardSession(backendUrl, provider, jiraDomain) {
    const response = await fetch(`${backendUrl}/auth/board/session/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, jiraDomain })
    });
    const body = await parseJsonResponse(response);

    if (!response.ok || body?.success === false || !body?.requestId) {
        throw new Error(body?.error?.message || 'Falha ao iniciar autenticacao OAuth.');
    }

    return {
        requestId: body.requestId,
        pollPath: body.pollPath,
        loginUrl: resolveLoginUrl(body.loginPath, backendUrl)
    };
}

// Retorna o corpo da resposta de polling (a decisao pending/completed e da aplicacao).
export async function pollSession(backendUrl, pollPath) {
    const pollUrl = resolveLoginUrl(pollPath, backendUrl);
    const response = await fetch(pollUrl, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
    const body = await parseJsonResponse(response);
    return { ok: response.ok, body };
}

