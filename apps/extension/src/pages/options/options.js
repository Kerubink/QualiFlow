import { sendRuntimeMessage as sendRuntimeMessageBridge } from '../../infrastructure/browser/runtimeMessaging.js';
import { getLocalStorage, setLocalStorage } from '../../infrastructure/persistence/localStorage.js';

let runnerProjects = [];
const DEFAULT_COPILOT_BACKEND_URL = 'https://qualiflow-gerador-de-cts.onrender.com';
const DEV_BACKEND_URL = 'http://localhost:3000';
const VALID_COPILOT_MODELS = ['claude-sonnet-4.5', 'gpt-5-mini', 'claude-opus-4.5'];

function sendRuntimeMessage(message, callback) {
    sendRuntimeMessageBridge(message)
        .then((response) => callback(response))
        .catch((error) => callback({ success: false, error: error.message }));
}

function setStorage(payload, callback) {
    setLocalStorage(payload).then(() => {
        if (typeof callback === 'function') callback();
    });
}

function getStorage(keys, callback) {
    getLocalStorage(keys).then((data) => callback(data));
}

function normalizeCopilotModel(model) {
    const value = (model || '').trim();
    return VALID_COPILOT_MODELS.includes(value) ? value : 'claude-sonnet-4.5';
}

function parseCopilotBackendUrl(rawValue) {
    const value = String(rawValue || '').trim();
    if (!value) {
        return { ok: true, url: DEFAULT_COPILOT_BACKEND_URL };
    }

    let parsed;
    try {
        parsed = new URL(value);
    } catch {
        return { ok: false, error: 'URL da API Copilot invalida. Inclua http:// ou https://.' };
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
        return { ok: false, error: 'A URL da API Copilot deve usar HTTP ou HTTPS.' };
    }

    return {
        ok: true,
        url: `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, '')
    };
}

function setCopilotAuthStatus(message, type = 'info') {
    const statusEl = document.getElementById('copilot-auth-status');
    if (!statusEl) return;

    statusEl.textContent = message;
    if (type === 'error') {
        statusEl.style.color = '#ef4444';
    } else if (type === 'success') {
        statusEl.style.color = '#10b981';
    } else {
        statusEl.style.color = '#94a3b8';
    }
}

async function startCopilotOAuthLogin() {
    const loginBtn = document.getElementById('copilot-login-btn');
    if (!loginBtn) return;

    loginBtn.disabled = true;
    setCopilotAuthStatus('Iniciando login...');

    try {
        const parsedCopilotBackend = parseCopilotBackendUrl(document.getElementById('copilot-backend-url')?.value);
        if (!parsedCopilotBackend.ok) {
            throw new Error(parsedCopilotBackend.error);
        }

        const startBody = await new Promise((resolve, reject) => {
            sendRuntimeMessage({ action: 'COPILOT_AUTH_START', backendUrl: parsedCopilotBackend.url }, (response) => {
                if (!response?.success) {
                    reject(new Error(response?.error || 'Falha ao iniciar autenticacao OAuth.'));
                    return;
                }
                resolve(response);
            });
        });

        setCopilotAuthStatus('Finalize o login na aba aberta...');

        const maxAttempts = 120;
        const delayMs = 2500;

        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));

            const pollBody = await new Promise((resolve, reject) => {
                sendRuntimeMessage({ action: 'COPILOT_AUTH_POLL', pollPath: startBody.pollPath, backendUrl: startBody.backendUrl }, (response) => {
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
                setCopilotAuthStatus(login ? `Autenticado como @${login}` : 'Autenticado com sucesso.', 'success');
                showStatus('Login GitHub concluido. Sessao salva automaticamente.', 'success');
                return;
            }
        }

        throw new Error('Tempo de login esgotado. Tente novamente.');
    } catch (error) {
        setCopilotAuthStatus(`Erro: ${error.message || 'falha no login'}`, 'error');
        showStatus(`Falha no login Copilot: ${error.message || 'erro desconhecido'}`, 'error');
    } finally {
        loginBtn.disabled = false;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    restoreOptions();
    setupNavigation();
    setupDynamicGroups();
    setupRunnerTab();
    setupDevModeToggle();
    document.getElementById('copilot-login-btn')?.addEventListener('click', startCopilotOAuthLogin);
    document.getElementById('azure-login-btn')?.addEventListener('click', () => startBoardOAuthLogin('azure'));
    document.getElementById('jira-login-btn')?.addEventListener('click', () => startBoardOAuthLogin('jira'));
});
document.getElementById('settings-form').addEventListener('submit', saveOptions);

function setupDevModeToggle() {
    const toggle = document.getElementById('dev-mode-toggle');
    const urlInput = document.getElementById('copilot-backend-url');
    if (!toggle || !urlInput) return;

    toggle.addEventListener('change', () => {
        if (toggle.checked) {
            urlInput.value = DEV_BACKEND_URL;
        } else if (urlInput.value.trim() === DEV_BACKEND_URL) {
            urlInput.value = '';
        }
    });
}

function setBoardAuthStatus(provider, message, type = 'info') {
    const statusEl = document.getElementById(`${provider}-auth-status`);
    if (!statusEl) return;

    statusEl.textContent = message;
    if (type === 'error') {
        statusEl.style.color = '#ef4444';
    } else if (type === 'success') {
        statusEl.style.color = '#10b981';
    } else {
        statusEl.style.color = '#94a3b8';
    }
}

async function startBoardOAuthLogin(provider) {
    const loginBtn = document.getElementById(`${provider}-login-btn`);
    if (!loginBtn) return;

    const startAction = provider === 'jira' ? 'JIRA_AUTH_START' : 'AZURE_AUTH_START';
    const pollAction = provider === 'jira' ? 'JIRA_AUTH_POLL' : 'AZURE_AUTH_POLL';
    const providerLabel = provider === 'jira' ? 'Atlassian' : 'Microsoft';

    loginBtn.disabled = true;
    setBoardAuthStatus(provider, 'Iniciando login...');

    try {
        const parsedBackend = parseCopilotBackendUrl(document.getElementById('copilot-backend-url')?.value);
        if (!parsedBackend.ok) {
            throw new Error(parsedBackend.error);
        }

        const jiraDomain = provider === 'jira' ? (document.getElementById('jira-domain')?.value.trim() || '') : undefined;

        const startBody = await new Promise((resolve, reject) => {
            sendRuntimeMessage({ action: startAction, backendUrl: parsedBackend.url, jiraDomain }, (response) => {
                if (!response?.success) {
                    reject(new Error(response?.error || 'Falha ao iniciar autenticacao OAuth.'));
                    return;
                }
                resolve(response);
            });
        });

        setBoardAuthStatus(provider, 'Finalize o login na aba aberta...');

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
                setBoardAuthStatus(provider, label ? `Autenticado como ${label}` : 'Autenticado com sucesso.', 'success');
                showStatus(`Login ${providerLabel} concluido. Sessao salva automaticamente.`, 'success');
                return;
            }
        }

        throw new Error('Tempo de login esgotado. Tente novamente.');
    } catch (error) {
        setBoardAuthStatus(provider, `Erro: ${error.message || 'falha no login'}`, 'error');
        showStatus(`Falha no login ${providerLabel}: ${error.message || 'erro desconhecido'}`, 'error');
    } finally {
        loginBtn.disabled = false;
    }
}

function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const tabContents = document.querySelectorAll('.tab-content');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            // Remove active from all tabs
            navItems.forEach(n => n.classList.remove('active'));
            tabContents.forEach(t => t.classList.remove('active'));

            // Add active to clicked tab
            item.classList.add('active');
            const targetId = item.getAttribute('data-target');
            document.getElementById(targetId).classList.add('active');
        });
    });
}

function setupDynamicGroups() {
    const boardSelect = document.getElementById('board-select');
    const aiSelect = document.getElementById('ai-select');

    const applyBoardGroupState = (provider) => {
        document.querySelectorAll('#board .dynamic-group').forEach((el) => {
            const isTarget = el.id === `board-${provider}`;
            el.classList.toggle('active-group', isTarget);

            // Guarantee fields from active provider are editable.
            el.querySelectorAll('input, select, textarea, button').forEach((field) => {
                if (field.id === 'board-select') return;
                field.disabled = !isTarget;
            });
        });
    };

    const applyAiGroupState = (provider) => {
        document.querySelectorAll('#ai .dynamic-group').forEach((el) => {
            const isTarget = el.id === `ai-${provider}`;
            el.classList.toggle('active-group', isTarget);
        });
    };

    boardSelect.addEventListener('change', (e) => {
        applyBoardGroupState(e.target.value);
    });

    aiSelect.addEventListener('change', (e) => {
        applyAiGroupState(e.target.value);
    });

    applyBoardGroupState(boardSelect.value);
    applyAiGroupState(aiSelect.value);
}

function saveOptions(e) {
    e.preventDefault();

    // General fields
    const qaEmail = document.getElementById('qa-email').value.trim();
    const qaTag = document.getElementById('qa-tag').value.trim();

    // Selections
    const selectedBoard = document.getElementById('board-select').value;
    const selectedAi = document.getElementById('ai-select').value;

    // Azure Fields
    const azureOrg = document.getElementById('azure-org').value.replace(/\/+$/, ""); // remove trailing slash
    const azureProject = document.getElementById('azure-project').value;
    const supportWebhookUrl = document.getElementById('support-webhook-url').value.trim();

    // Jira Fields
    const jiraDomain = document.getElementById('jira-domain')?.value.trim() || '';
    const jiraProjectKey = document.getElementById('jira-project')?.value.trim() || '';
    const jiraTestIssueType = document.getElementById('jira-test-issue-type')?.value.trim() || 'Task';
    const jiraAcceptanceFieldId = document.getElementById('jira-ac-field')?.value.trim() || '';
    const jiraLinkType = document.getElementById('jira-link-type')?.value.trim() || 'Relates';

    // Gemini Fields
    const geminiKey = document.getElementById('gemini-key').value;
    const geminiModel = document.getElementById('gemini-model').value || 'gemini-2.5-flash';

    // Copilot Fields
    const devModeEnabled = document.getElementById('dev-mode-toggle')?.checked || false;
    const parsedCopilotBackend = parseCopilotBackendUrl(document.getElementById('copilot-backend-url')?.value);
    if (!parsedCopilotBackend.ok) {
        showStatus(parsedCopilotBackend.error, 'error');
        return;
    }
    const copilotBackendUrl = parsedCopilotBackend.url;
    const copilotModel = normalizeCopilotModel(document.getElementById('copilot-model').value);

    // Groq Fields
    const groqKey = document.getElementById('groq-key').value;
    const groqModel = document.getElementById('groq-model').value || 'llama3-70b-8192';

    setStorage(
        {
            qaEmail, qaTag, selectedBoard, selectedAi,
            azureOrg, azureProject,
            supportWebhookUrl,
            jiraDomain, jiraProjectKey, jiraTestIssueType, jiraAcceptanceFieldId, jiraLinkType,
            geminiKey, geminiModel,
            copilotBackendUrl,
            devModeEnabled,
            copilotModel,
            groqKey, groqModel,
            runnerProjects, runnerEnabled: true
        },
        () => {
            showStatus('Configurações salvas com sucesso!', 'success');
        }
    );
}

// =======================
// RUNNER TAB LOGIC
// =======================
function setupRunnerTab() {
    // Add Listeners para Load Models
    document.getElementById('load-gemini-models-btn')?.addEventListener('click', () => {
        const keyEl = document.getElementById('gemini-key');
        const statusEl = document.getElementById('gemini-models-status');
        const selectEl = document.getElementById('gemini-model');
        if (!keyEl || !keyEl.value.trim()) {
            if (statusEl) { statusEl.textContent = 'Insira a API Key primeiro.'; statusEl.style.color = '#ef4444'; }
            return;
        }
        if (statusEl) { statusEl.textContent = 'Carregando...'; statusEl.style.color = '#94a3b8'; }
        setStorage({ geminiKey: keyEl.value.trim() }, () => {
            sendRuntimeMessage({ action: 'GET_GEMINI_MODELS' }, (response) => {
                if (response && response.error) {
                    if (statusEl) { statusEl.textContent = `Erro: ${response.error}`; statusEl.style.color = '#ef4444'; }
                    return;
                }
                const models = response?.models || [];
                if (!models.length) {
                    if (statusEl) { statusEl.textContent = 'Nenhum modelo encontrado.'; statusEl.style.color = '#f59e0b'; }
                    return;
                }
                const currentVal = selectEl.value;
                selectEl.innerHTML = models.map(m => `<option value="${m}">${m}</option>`).join('');
                if (models.includes(currentVal)) selectEl.value = currentVal;
                if (statusEl) { statusEl.textContent = `${models.length} modelo(s) carregado(s) com sucesso!`; statusEl.style.color = '#10b981'; }
            });
        });
    });

    document.getElementById('load-copilot-models-btn')?.addEventListener('click', () => {
        const statusEl = document.getElementById('copilot-models-status');
        const selectEl = document.getElementById('copilot-model');
        if (statusEl) { statusEl.textContent = 'Carregando...'; statusEl.style.color = '#94a3b8'; }
        sendRuntimeMessage({ action: 'GET_COPILOT_MODELS' }, (response) => {
            if (response && response.error) {
                if (statusEl) { statusEl.textContent = `Erro: ${response.error}`; statusEl.style.color = '#ef4444'; }
                return;
            }
            const models = response?.models || [];
            if (!models.length) {
                if (statusEl) { statusEl.textContent = 'Nenhum modelo encontrado.'; statusEl.style.color = '#f59e0b'; }
                return;
            }
            const currentVal = selectEl.value;
            const allowedModels = models.filter((m) => VALID_COPILOT_MODELS.includes(m));
            if (!allowedModels.length) {
                if (statusEl) { statusEl.textContent = 'Nenhum modelo permitido foi retornado.'; statusEl.style.color = '#f59e0b'; }
                return;
            }

            selectEl.innerHTML = allowedModels.map(m => `<option value="${m}">${m}</option>`).join('');
            selectEl.value = normalizeCopilotModel(currentVal);
            if (statusEl) { statusEl.textContent = `${allowedModels.length} modelo(s) permitido(s) carregado(s)!`; statusEl.style.color = '#10b981'; }
        });
    });

    document.getElementById('btn-add-runner-project')?.addEventListener('click', () => {
        const nameInput = document.getElementById('runner-new-name');
        const urlInput = document.getElementById('runner-new-url');
        const name = nameInput.value.trim();
        const url = urlInput.value.trim();

        if (!name || !url) {
            showStatus('Preencha o nome e a URL alvo', 'error');
            return;
        }

        runnerProjects.push({ name, url });
        nameInput.value = '';
        urlInput.value = '';

        renderRunnerProjects();
        setStorage({ runnerProjects }, () => {
            showStatus('Projeto adicionado!', 'success');
        });
    });
}


function renderRunnerProjects() {
    const list = document.getElementById('runner-projects-list');
    list.innerHTML = '';

    if (runnerProjects.length === 0) {
        list.innerHTML = '<li style="color:#94a3b8; font-size:0.85rem; padding: 12px; font-style:italic;">Nenhum projeto configurado.</li>';
        return;
    }

    runnerProjects.forEach((proj, index) => {
        const li = document.createElement('li');
        li.style.display = 'flex';
        li.style.justifyContent = 'space-between';
        li.style.alignItems = 'center';
        li.style.padding = '12px 16px';
        li.style.marginBottom = '8px';
        li.style.background = '#1e293b';
        li.style.border = '1px solid #334155';
        li.style.borderRadius = '6px';

        li.innerHTML = `
            <div>
                <strong style="color:#f8fafc; display:block; font-size:0.9rem;">${proj.name}</strong>
                <span style="color:#94a3b8; font-size:0.75rem;">${proj.url}</span>
            </div>
            <button class="btn-del-proj" data-index="${index}" style="background:transparent; border:none; color:#ef4444; cursor:pointer;" title="Remover">
                <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
            </button>
        `;
        list.appendChild(li);
    });

    document.querySelectorAll('.btn-del-proj').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = e.currentTarget.getAttribute('data-index');
            runnerProjects.splice(idx, 1);
            renderRunnerProjects();
            setStorage({ runnerProjects });
        });
    });
}

function restoreOptions() {
    getStorage(
        [
            'qaEmail', 'qaTag', 'selectedBoard', 'selectedAi',
            'azureSessionToken', 'azureOrg', 'azureProject',
            'supportWebhookUrl',
            'jiraSessionToken', 'jiraDomain', 'jiraProjectKey', 'jiraTestIssueType', 'jiraAcceptanceFieldId', 'jiraLinkType',
            'geminiKey', 'geminiModel',
            'copilotToken', 'copilotSessionToken', 'copilotBackendUrl', 'devModeEnabled', 'copilotModel',
            'groqKey', 'groqModel'
        ],
        (items) => {
            // General
            if (items.qaEmail) document.getElementById('qa-email').value = items.qaEmail;
            if (items.qaTag) document.getElementById('qa-tag').value = items.qaTag;

            // Selections (trigger change events to update UI dynamically)
            if (items.selectedBoard) {
                const boardSelect = document.getElementById('board-select');
                boardSelect.value = items.selectedBoard;
                boardSelect.dispatchEvent(new Event('change'));
            }
            if (items.selectedAi) {
                const aiSelect = document.getElementById('ai-select');
                const normalizedAi = ['gemini', 'copilot', 'groq'].includes(items.selectedAi) ? items.selectedAi : 'gemini';
                aiSelect.value = normalizedAi;
                aiSelect.dispatchEvent(new Event('change'));
            }

            // Azure
            if (items.azureOrg) document.getElementById('azure-org').value = items.azureOrg;
            if (items.azureProject) document.getElementById('azure-project').value = items.azureProject;
            if (items.supportWebhookUrl) document.getElementById('support-webhook-url').value = items.supportWebhookUrl;
            setBoardAuthStatus('azure', items.azureSessionToken ? 'Sessao OAuth carregada.' : 'Nao autenticado.', items.azureSessionToken ? 'success' : 'info');

            // Jira
            if (items.jiraDomain && document.getElementById('jira-domain')) document.getElementById('jira-domain').value = items.jiraDomain;
            if (items.jiraProjectKey && document.getElementById('jira-project')) document.getElementById('jira-project').value = items.jiraProjectKey;
            if (document.getElementById('jira-test-issue-type')) document.getElementById('jira-test-issue-type').value = items.jiraTestIssueType || 'Task';
            if (document.getElementById('jira-link-type')) document.getElementById('jira-link-type').value = items.jiraLinkType || 'Relates';
            if (items.jiraAcceptanceFieldId && document.getElementById('jira-ac-field')) document.getElementById('jira-ac-field').value = items.jiraAcceptanceFieldId;
            setBoardAuthStatus('jira', items.jiraSessionToken ? 'Sessao OAuth carregada.' : 'Nao autenticado.', items.jiraSessionToken ? 'success' : 'info');

            // Gemini
            if (items.geminiKey) document.getElementById('gemini-key').value = items.geminiKey;
            if (items.geminiModel) {
                const geminiModelSelect = document.getElementById('gemini-model');
                let found = Array.from(geminiModelSelect.options).some(o => o.value === items.geminiModel);
                if (!found) {
                    const opt = document.createElement('option');
                    opt.value = items.geminiModel;
                    opt.textContent = items.geminiModel;
                    geminiModelSelect.appendChild(opt);
                }
                geminiModelSelect.value = items.geminiModel;
            }

            // Copilot
            const storedCopilotToken = items.copilotSessionToken || items.copilotToken || '';
            if (storedCopilotToken) {
                setCopilotAuthStatus('Sessao OAuth carregada.', 'success');
            } else {
                setCopilotAuthStatus('Nao autenticado.', 'info');
            }
            const copilotBackendUrlInput = document.getElementById('copilot-backend-url');
            if (copilotBackendUrlInput) {
                copilotBackendUrlInput.value = items.copilotBackendUrl || DEFAULT_COPILOT_BACKEND_URL;
            }
            const devModeToggle = document.getElementById('dev-mode-toggle');
            if (devModeToggle) {
                devModeToggle.checked = Boolean(items.devModeEnabled);
            }
            if (items.copilotModel) {
                const copilotModelSelect = document.getElementById('copilot-model');
                copilotModelSelect.value = normalizeCopilotModel(items.copilotModel);
            }

            // Groq
            if (items.groqKey) document.getElementById('groq-key').value = items.groqKey;
            if (items.groqModel) {
                const groqModelSelect = document.getElementById('groq-model');
                let found = Array.from(groqModelSelect.options).some(o => o.value === items.groqModel);
                if (!found) {
                    const opt = document.createElement('option');
                    opt.value = items.groqModel;
                    opt.textContent = items.groqModel;
                    groqModelSelect.appendChild(opt);
                }
                groqModelSelect.value = items.groqModel;
            }

            // Runner Projects
            runnerProjects = items.runnerProjects || [];
            renderRunnerProjects();
        }
    );
}

function showStatus(message, type) {
    const statusEl = document.getElementById('status-message');
    statusEl.textContent = message;
    statusEl.className = `status-message ${type}`;

    setTimeout(() => {
        statusEl.className = 'status-message';
        statusEl.textContent = '';
    }, 3000);
}
