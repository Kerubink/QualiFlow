import { sendRuntimeMessage } from '../shared/runtime.js';
import { parseBackendUrl } from '../../../domain/backendUrl.js';
import { showStatus, setStatusTone } from './status.js';
import { RuntimeActions } from '../../../contracts/runtimeActions.js';

export function setCopilotAuthStatusUI(message, type = 'info') {
    const el = document.getElementById('qualiflow-copilot-auth-status');
    if (!el) return;

    el.textContent = message;
    setStatusTone(el, type === 'error' ? 'error' : (type === 'success' ? 'success' : 'muted'));
}
export async function startCopilotOAuthLoginUI() {
    const loginBtn = document.getElementById('qualiflow-copilot-login-btn');
    if (!loginBtn) return;

    loginBtn.disabled = true;
    setCopilotAuthStatusUI('Iniciando login...');

    try {
        const parsedCopilotBackend = parseBackendUrl(document.getElementById('qualiflow-settings-copilot-backend-url')?.value);
        if (!parsedCopilotBackend.ok) {
            throw new Error(parsedCopilotBackend.error);
        }

        const startBody = await new Promise((resolve, reject) => {
            sendRuntimeMessage({ action: RuntimeActions.COPILOT_AUTH_START, backendUrl: parsedCopilotBackend.url }, (response) => {
                if (!response?.success) {
                    reject(new Error(response?.error || 'Falha ao iniciar autenticacao OAuth.'));
                    return;
                }
                resolve(response);
            });
        });

        setCopilotAuthStatusUI('Finalize o login na aba aberta...');

        const maxAttempts = 120;
        const delayMs = 2500;

        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));

            const pollBody = await new Promise((resolve, reject) => {
                sendRuntimeMessage({ action: RuntimeActions.COPILOT_AUTH_POLL, pollPath: startBody.pollPath, backendUrl: startBody.backendUrl }, (response) => {
                    if (!response?.success) {
                        reject(new Error(response?.error || 'Falha ao concluir login OAuth.'));
                        return;
                    }
                    resolve(response);
                });
            });

            if (pollBody?.status === 'pending') {
                continue;
            }

            if (pollBody?.status === 'completed' && pollBody?.sessionToken) {
                const login = pollBody?.user?.login;
                setCopilotAuthStatusUI(login ? `Autenticado como @${login}` : 'Autenticado com sucesso.', 'success');
                showStatus('Login GitHub concluido. Sessao salva automaticamente.');
                return;
            }
        }

        throw new Error('Tempo de login esgotado. Tente novamente.');
    } catch (error) {
        setCopilotAuthStatusUI(`Erro: ${error.message || 'falha no login'}`, 'error');
        showStatus(`Falha no login Copilot: ${error.message || 'erro desconhecido'}`, true);
    } finally {
        loginBtn.disabled = false;
    }
}
export function setBoardAuthStatusUI(provider, message, type = 'info') {
    const statusEl = document.getElementById(`qualiflow-${provider}-auth-status`);
    if (!statusEl) return;

    statusEl.textContent = message;
    setStatusTone(statusEl, type === 'error' ? 'error' : (type === 'success' ? 'success' : 'muted'));
}
export async function startBoardOAuthLoginUI(provider) {
    const loginBtn = document.getElementById(`qualiflow-${provider}-login-btn`);
    if (!loginBtn) return;

    const startAction = provider === 'jira' ? 'JIRA_AUTH_START' : 'AZURE_AUTH_START';
    const pollAction = provider === 'jira' ? 'JIRA_AUTH_POLL' : 'AZURE_AUTH_POLL';
    const providerLabel = provider === 'jira' ? 'Atlassian' : 'Microsoft';

    loginBtn.disabled = true;
    setBoardAuthStatusUI(provider, 'Iniciando login...');

    try {
        const parsedBackend = parseBackendUrl(document.getElementById('qualiflow-settings-copilot-backend-url')?.value);
        if (!parsedBackend.ok) {
            throw new Error(parsedBackend.error);
        }

        const jiraDomain = provider === 'jira' ? (document.getElementById('qualiflow-settings-jira-domain')?.value.trim() || '') : undefined;

        const startBody = await new Promise((resolve, reject) => {
            sendRuntimeMessage({ action: startAction, backendUrl: parsedBackend.url, jiraDomain }, (response) => {
                if (!response?.success) {
                    reject(new Error(response?.error || 'Falha ao iniciar autenticacao OAuth.'));
                    return;
                }
                resolve(response);
            });
        });

        setBoardAuthStatusUI(provider, 'Finalize o login na aba aberta...');

        const maxAttempts = 120;
        const delayMs = 2500;

        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));

            const pollBody = await new Promise((resolve, reject) => {
                sendRuntimeMessage({ action: pollAction, pollPath: startBody.pollPath, backendUrl: startBody.backendUrl }, (response) => {
                    if (!response?.success) {
                        reject(new Error(response?.error || 'Falha ao concluir login OAuth.'));
                        return;
                    }
                    resolve(response);
                });
            });

            if (pollBody?.status === 'pending') {
                continue;
            }

            if (pollBody?.status === 'completed' && pollBody?.sessionToken) {
                const label = pollBody?.user?.displayName || pollBody?.user?.name || pollBody?.user?.email || pollBody?.user?.emailAddress;
                setBoardAuthStatusUI(provider, label ? `Autenticado como ${label}` : 'Autenticado com sucesso.', 'success');
                showStatus(`Login ${providerLabel} concluido. Sessao salva automaticamente.`);
                return;
            }
        }

        throw new Error('Tempo de login esgotado. Tente novamente.');
    } catch (error) {
        setBoardAuthStatusUI(provider, `Erro: ${error.message || 'falha no login'}`, 'error');
        showStatus(`Falha no login ${providerLabel}: ${error.message || 'erro desconhecido'}`, true);
    } finally {
        loginBtn.disabled = false;
    }
}
