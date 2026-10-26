// Login OAuth (GitHub/Copilot, Microsoft/Azure, Atlassian/Jira) via background + polling.
import { parseBackendUrl } from '../../domain/backendUrl.js';
import { resolveBoardUserLabel } from '../../domain/optionsSelection.js';
import { loadAzureOrganizations } from './azureDiscovery.js';
import { requestOrReject } from './messaging.js';
import { setBoardAuthStatus, setCopilotAuthStatus, showStatus } from './ui.js';
import { RuntimeActions } from '../../contracts/runtimeActions.js';

const MAX_POLL_ATTEMPTS = 120;
const POLL_DELAY_MS = 2500;

// Faz polling ate a sessao completar. Retorna a resposta 'completed' ou lanca por timeout/erro.
async function pollUntilCompleted(pollAction, startBody) {
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, POLL_DELAY_MS));

        const pollBody = await requestOrReject(
            { action: pollAction, pollPath: startBody.pollPath, backendUrl: startBody.backendUrl },
            'Falha ao concluir login OAuth.'
        );

        if (pollBody?.status === 'pending') {
            continue;
        }

        if (pollBody?.status === 'completed' && pollBody?.sessionToken) {
            return pollBody;
        }
    }

    throw new Error('Tempo de login esgotado. Tente novamente.');
}

export async function startCopilotOAuthLogin() {
    const loginBtn = document.getElementById('copilot-login-btn');
    if (!loginBtn) return;

    loginBtn.disabled = true;
    setCopilotAuthStatus('Iniciando login...');

    try {
        const parsedCopilotBackend = parseBackendUrl(document.getElementById('copilot-backend-url')?.value);
        if (!parsedCopilotBackend.ok) {
            throw new Error(parsedCopilotBackend.error);
        }

        const startBody = await requestOrReject(
            { action: RuntimeActions.COPILOT_AUTH_START, backendUrl: parsedCopilotBackend.url },
            'Falha ao iniciar autenticacao OAuth.'
        );

        setCopilotAuthStatus('Finalize o login na aba aberta...');

        const pollBody = await pollUntilCompleted('COPILOT_AUTH_POLL', startBody);
        const login = pollBody?.user?.login;
        setCopilotAuthStatus(login ? `Autenticado como @${login}` : 'Autenticado com sucesso.', 'success');
        showStatus('Login GitHub concluido. Sessao salva automaticamente.', 'success');
    } catch (error) {
        setCopilotAuthStatus(`Erro: ${error.message || 'falha no login'}`, 'error');
        showStatus(`Falha no login Copilot: ${error.message || 'erro desconhecido'}`, 'error');
    } finally {
        loginBtn.disabled = false;
    }
}

export async function startBoardOAuthLogin(provider) {
    const loginBtn = document.getElementById(`${provider}-login-btn`);
    if (!loginBtn) return;

    const startAction = provider === 'jira' ? 'JIRA_AUTH_START' : 'AZURE_AUTH_START';
    const pollAction = provider === 'jira' ? 'JIRA_AUTH_POLL' : 'AZURE_AUTH_POLL';
    const providerLabel = provider === 'jira' ? 'Atlassian' : 'Microsoft';

    loginBtn.disabled = true;
    setBoardAuthStatus(provider, 'Iniciando login...');

    try {
        const parsedBackend = parseBackendUrl(document.getElementById('copilot-backend-url')?.value);
        if (!parsedBackend.ok) {
            throw new Error(parsedBackend.error);
        }

        const jiraDomain = provider === 'jira' ? (document.getElementById('jira-domain')?.value.trim() || '') : undefined;

        const startBody = await requestOrReject(
            { action: startAction, backendUrl: parsedBackend.url, jiraDomain },
            'Falha ao iniciar autenticacao OAuth.'
        );

        setBoardAuthStatus(provider, 'Finalize o login na aba aberta...');

        const pollBody = await pollUntilCompleted(pollAction, startBody);
        const label = resolveBoardUserLabel(pollBody?.user);
        setBoardAuthStatus(provider, label ? `Autenticado como ${label}` : 'Autenticado com sucesso.', 'success');
        showStatus(`Login ${providerLabel} concluido. Sessao salva automaticamente.`, 'success');
        if (provider === 'azure') {
            // Sessao acabou de ser salva pelo listener de storage do background; busca as
            // organizacoes/projetos automaticamente em vez de exigir digitar manualmente.
            loadAzureOrganizations();
        }
    } catch (error) {
        setBoardAuthStatus(provider, `Erro: ${error.message || 'falha no login'}`, 'error');
        showStatus(`Falha no login ${providerLabel}: ${error.message || 'erro desconhecido'}`, 'error');
    } finally {
        loginBtn.disabled = false;
    }
}
