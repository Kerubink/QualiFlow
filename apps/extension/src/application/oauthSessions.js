import { normalizeBackendUrl } from '../domain/backendUrl.js';

async function resolveBackendUrl(backendUrlHint, getSettings) {
    if (String(backendUrlHint || '').trim()) return normalizeBackendUrl(backendUrlHint);
    const settings = await getSettings();
    return normalizeBackendUrl(settings?.copilotBackendUrl);
}

// Inicia o login GitHub (Copilot): abre a aba de login e devolve o necessario para o polling.
export async function startCopilotLogin({ backendUrl: hint }, { getSettings, authClient, openTab }) {
    const backendUrl = await resolveBackendUrl(hint, getSettings);
    const session = await authClient.requestCopilotSession(backendUrl);
    await openTab(session.loginUrl);
    return { requestId: session.requestId, pollPath: session.pollPath, backendUrl };
}

// provider: 'microsoft' (Azure DevOps) | 'atlassian' (Jira)
export async function startBoardLogin({ provider, backendUrl: hint, jiraDomain }, { getSettings, authClient, openTab }) {
    const backendUrl = await resolveBackendUrl(hint, getSettings);
    const session = await authClient.requestBoardSession(backendUrl, provider, jiraDomain);
    await openTab(session.loginUrl);
    return { requestId: session.requestId, pollPath: session.pollPath, backendUrl };
}

// Consulta o backend; ao concluir, persiste o sessionToken (e a URL do backend) localmente.
async function pollLogin({ pollPath, backendUrl: hint, persistSession }, { getSettings, authClient, saveSettings }) {
    const backendUrl = await resolveBackendUrl(hint, getSettings);
    const { ok, body } = await authClient.pollSession(backendUrl, pollPath);

    if (body?.status === 'pending') {
        return { status: 'pending' };
    }

    if (!ok || body?.success === false) {
        throw new Error(body?.error?.message || 'Falha ao concluir login OAuth.');
    }

    if (body?.status === 'completed' && body?.sessionToken) {
        await saveSettings({ ...persistSession(body.sessionToken), copilotBackendUrl: backendUrl });
        return {
            status: 'completed',
            sessionToken: body.sessionToken,
            user: body.user || null,
            expiresAt: body.expiresAt || null
        };
    }

    return { status: 'pending' };
}

export function pollCopilotLogin({ pollPath, backendUrl }, deps) {
    return pollLogin({
        pollPath,
        backendUrl,
        persistSession: (token) => ({ copilotToken: token, copilotSessionToken: token })
    }, deps);
}

// provider: 'jira' | 'azure'
export function pollBoardLogin({ provider, pollPath, backendUrl }, deps) {
    const storageKey = provider === 'jira' ? 'jiraSessionToken' : 'azureSessionToken';
    return pollLogin({
        pollPath,
        backendUrl,
        persistSession: (token) => ({ [storageKey]: token })
    }, deps);
}
