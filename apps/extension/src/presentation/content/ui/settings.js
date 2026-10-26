import { sendRuntimeMessage, getStorage, setStorage } from '../shared/runtime.js';
import { DEFAULT_BACKEND_URL, DEV_BACKEND_URL, VALID_COPILOT_MODELS, normalizeCopilotModel } from '../../../domain/constants.js';
import { parseBackendUrl } from '../../../domain/backendUrl.js';
import { setStatusTone } from './status.js';
import { uiState } from './uiState.js';
import { setCopilotAuthStatusUI, setBoardAuthStatusUI, startCopilotOAuthLoginUI, startBoardOAuthLoginUI } from './oauth.js';
import { renderUIRunnerProjects } from './runnerProjects.js';
import { RuntimeActions } from '../../../contracts/runtimeActions.js';

export function loadSettingsToUI() {
    getStorage([
        'azureSessionToken', 'azurePat', 'azureOrg', 'azureProject', 'geminiKey', 'geminiModel',
        'supportWebhookUrl',
        'qaEmail', 'qaTag', 'selectedBoard', 'selectedAi', 'runnerProjects',
        'copilotToken', 'copilotSessionToken', 'copilotBackendUrl', 'devModeEnabled', 'copilotModel', 'groqKey', 'groqModel',
        'jiraSessionToken', 'jiraDomain', 'jiraProjectKey', 'jiraTestIssueType', 'jiraAcceptanceFieldId', 'jiraLinkType'
    ], (data) => {
        document.getElementById('qualiflow-settings-org').value = data.azureOrg || '';
        document.getElementById('qualiflow-settings-proj').value = data.azureProject || '';
        const azurePatEl = document.getElementById('qualiflow-settings-azure-pat');
        if (azurePatEl) azurePatEl.value = data.azurePat || '';
        if (data.azurePat) {
            setBoardAuthStatusUI('azure', 'Usando PAT.', 'success');
        } else {
            setBoardAuthStatusUI('azure', data.azureSessionToken ? 'Sessao OAuth carregada.' : 'Nao autenticado.', data.azureSessionToken ? 'success' : 'info');
        }
        document.getElementById('qualiflow-settings-gemini-key').value = data.geminiKey || '';
        const geminiModelEl = document.getElementById('qualiflow-settings-gemini-model');
        if (geminiModelEl && data.geminiModel) {
            const found = Array.from(geminiModelEl.options).some(o => o.value === data.geminiModel);
            if (!found) {
                const opt = document.createElement('option');
                opt.value = data.geminiModel;
                opt.textContent = data.geminiModel;
                geminiModelEl.appendChild(opt);
            }
            geminiModelEl.value = data.geminiModel;
        }

        const storedCopilotToken = data.copilotSessionToken || data.copilotToken || '';
        if (storedCopilotToken) {
            setCopilotAuthStatusUI('Sessao OAuth carregada.', 'success');
        } else {
            setCopilotAuthStatusUI('Nao autenticado.', 'info');
        }
        const copilotModEl = document.getElementById('qualiflow-settings-copilot-model');
        if (copilotModEl && data.copilotModel) {
            copilotModEl.value = normalizeCopilotModel(data.copilotModel);
        }
        const copilotBackendEl = document.getElementById('qualiflow-settings-copilot-backend-url');
        if (copilotBackendEl) {
            copilotBackendEl.value = data.copilotBackendUrl || DEFAULT_BACKEND_URL;
        }
        const devModeToggleEl = document.getElementById('qualiflow-dev-mode-toggle');
        if (devModeToggleEl) {
            devModeToggleEl.checked = Boolean(data.devModeEnabled);
        }

        const groqKeyEl = document.getElementById('qualiflow-settings-groq-key');
        if (groqKeyEl) groqKeyEl.value = data.groqKey || '';
        const groqModelEl = document.getElementById('qualiflow-settings-groq-model');
        if (groqModelEl && data.groqModel) {
            const found = Array.from(groqModelEl.options).some(o => o.value === data.groqModel);
            if (!found) {
                const opt = document.createElement('option');
                opt.value = data.groqModel;
                opt.textContent = data.groqModel;
                groqModelEl.appendChild(opt);
            }
            groqModelEl.value = data.groqModel;
        }

        document.getElementById('qualiflow-settings-qa-email').value = data.qaEmail || '';
        document.getElementById('qualiflow-settings-qa-tag').value = data.qaTag || '';
        const supportWebhookEl = document.getElementById('qualiflow-settings-support-webhook-url');
        if (supportWebhookEl) supportWebhookEl.value = data.supportWebhookUrl || '';

        const jiraDomainEl = document.getElementById('qualiflow-settings-jira-domain');
        if (jiraDomainEl) jiraDomainEl.value = data.jiraDomain || '';
        setBoardAuthStatusUI('jira', data.jiraSessionToken ? 'Sessao OAuth carregada.' : 'Nao autenticado.', data.jiraSessionToken ? 'success' : 'info');
        const jiraProjectEl = document.getElementById('qualiflow-settings-jira-project');
        if (jiraProjectEl) jiraProjectEl.value = data.jiraProjectKey || '';
        const jiraTestTypeEl = document.getElementById('qualiflow-settings-jira-test-type');
        if (jiraTestTypeEl) jiraTestTypeEl.value = data.jiraTestIssueType || 'Task';
        const jiraAcFieldEl = document.getElementById('qualiflow-settings-jira-ac-field');
        if (jiraAcFieldEl) jiraAcFieldEl.value = data.jiraAcceptanceFieldId || '';
        const jiraLinkTypeEl = document.getElementById('qualiflow-settings-jira-link-type');
        if (jiraLinkTypeEl) jiraLinkTypeEl.value = data.jiraLinkType || 'Relates';

        uiState.runnerProjects = data.runnerProjects || [];
        renderUIRunnerProjects();

        const boardSel = document.getElementById('qualiflow-settings-board-select');
        if (data.selectedBoard) boardSel.value = data.selectedBoard;

        const aiSel = document.getElementById('qualiflow-settings-ai-select');
        if (data.selectedAi) aiSel.value = ['gemini', 'copilot', 'groq'].includes(data.selectedAi) ? data.selectedAi : 'gemini';

        // Dispara o evento de "change" para renderizar correto as abas caso hajam defaults
        boardSel.dispatchEvent(new Event('change'));
        aiSel.dispatchEvent(new Event('change'));
    });

    // Lógica das Abas (Navegação Sidebar)
    const navItems = document.querySelectorAll('#qualiflow-settings-nav li');
    navItems.forEach(item => {
        item.onclick = () => {
            navItems.forEach(n => {
                n.classList.remove('qualiflow-tab-active');
                n.setAttribute('aria-selected', 'false');
                n.setAttribute('tabindex', '-1');
            });
            item.classList.add('qualiflow-tab-active');
            item.setAttribute('aria-selected', 'true');
            item.setAttribute('tabindex', '0');

            document.querySelectorAll('.qualiflow-tab-pane').forEach(p => p.classList.add('qualiflow-hidden'));
            document.getElementById(item.getAttribute('data-target')).classList.remove('qualiflow-hidden');
        };
        item.onkeydown = (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                item.onclick();
            } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                const list = Array.from(navItems);
                const delta = e.key === 'ArrowDown' ? 1 : -1;
                const next = list[(list.indexOf(item) + delta + list.length) % list.length];
                next.focus();
                next.onclick();
            }
        };
    });

    // Lógica dos Selects
    document.getElementById('qualiflow-settings-board-select').onchange = (e) => {
        ['azure', 'jira', 'asana'].forEach(b => {
            const g = document.getElementById('qualiflow-group-' + b);
            if (g) g.classList.add('qualiflow-hidden');
        });
        const t = document.getElementById('qualiflow-group-' + e.target.value);
        if (t) t.classList.remove('qualiflow-hidden');
    };

    document.getElementById('qualiflow-settings-ai-select').onchange = (e) => {
        ['gemini', 'copilot', 'groq'].forEach(a => {
            const g = document.getElementById('qualiflow-group-' + a);
            if (g) g.classList.add('qualiflow-hidden');
        });
        const t = document.getElementById('qualiflow-group-' + e.target.value);
        if (t) t.classList.remove('qualiflow-hidden');
    };

    document.getElementById('qualiflow-settings-save-btn').onclick = () => {
        const parsedCopilotBackend = parseBackendUrl(document.getElementById('qualiflow-settings-copilot-backend-url')?.value);
        if (!parsedCopilotBackend.ok) {
            const feed = document.getElementById('qualiflow-settings-feedback');
            feed.textContent = parsedCopilotBackend.error;
            feed.className = 'qualiflow-error';
            feed.classList.remove('qualiflow-hidden');
            return;
        }

        const payload = {
            selectedBoard: document.getElementById('qualiflow-settings-board-select').value,
            selectedAi: document.getElementById('qualiflow-settings-ai-select').value,
            azureOrg: document.getElementById('qualiflow-settings-org').value.replace(/\/$/, ''), // remove trailing slash
            azureProject: document.getElementById('qualiflow-settings-proj').value,
            azurePat: document.getElementById('qualiflow-settings-azure-pat')?.value.trim() || '',
            geminiKey: document.getElementById('qualiflow-settings-gemini-key').value,
            geminiModel: document.getElementById('qualiflow-settings-gemini-model').value,
            copilotBackendUrl: parsedCopilotBackend.url,
            devModeEnabled: document.getElementById('qualiflow-dev-mode-toggle')?.checked || false,
            copilotModel: normalizeCopilotModel(document.getElementById('qualiflow-settings-copilot-model')?.value),
            groqKey: document.getElementById('qualiflow-settings-groq-key')?.value || '',
            groqModel: document.getElementById('qualiflow-settings-groq-model')?.value || 'llama3-70b-8192',
            jiraDomain: document.getElementById('qualiflow-settings-jira-domain')?.value.trim() || '',
            jiraProjectKey: document.getElementById('qualiflow-settings-jira-project')?.value.trim() || '',
            jiraTestIssueType: document.getElementById('qualiflow-settings-jira-test-type')?.value.trim() || 'Task',
            jiraAcceptanceFieldId: document.getElementById('qualiflow-settings-jira-ac-field')?.value.trim() || '',
            jiraLinkType: document.getElementById('qualiflow-settings-jira-link-type')?.value.trim() || 'Relates',
            qaEmail: document.getElementById('qualiflow-settings-qa-email').value.trim(),
            qaTag: document.getElementById('qualiflow-settings-qa-tag').value.trim(),
            supportWebhookUrl: document.getElementById('qualiflow-settings-support-webhook-url')?.value.trim() || '',
            runnerProjects: uiState.runnerProjects
        };
        setStorage(payload, () => {
            const feed = document.getElementById('qualiflow-settings-feedback');
            feed.textContent = "Configurações salvas localmente com sucesso!";
            feed.className = 'qualiflow-info';
            feed.classList.remove('qualiflow-hidden');
            setTimeout(() => { feed.classList.add('qualiflow-hidden') }, 5000);
        });
    };

    // Gemini - Carregar Modelos
    document.getElementById('qualiflow-load-gemini-models')?.addEventListener('click', () => {
        const keyEl = document.getElementById('qualiflow-settings-gemini-key');
        const statusEl = document.getElementById('qualiflow-gemini-models-status');
        const selectEl = document.getElementById('qualiflow-settings-gemini-model');
        if (!keyEl || !keyEl.value.trim()) {
            if (statusEl) { statusEl.textContent = 'Insira a API Key primeiro.'; setStatusTone(statusEl, 'error'); }
            return;
        }
        if (statusEl) { statusEl.textContent = 'Carregando...'; setStatusTone(statusEl, 'muted'); }
        setStorage({ geminiKey: keyEl.value.trim() }, () => {
            sendRuntimeMessage({ action: RuntimeActions.GET_GEMINI_MODELS }, (response) => {
                if (response && response.error) {
                    if (statusEl) { statusEl.textContent = `Erro: ${response.error}`; setStatusTone(statusEl, 'error'); }
                    return;
                }
                const models = response?.models || [];
                if (!models.length) {
                    if (statusEl) { statusEl.textContent = 'Nenhum modelo encontrado.'; setStatusTone(statusEl, 'warning'); }
                    return;
                }
                const currentVal = selectEl.value;
                selectEl.innerHTML = models.map(m => `<option value="${m}">${m}</option>`).join('');
                if (models.includes(currentVal)) selectEl.value = currentVal;
                if (statusEl) { statusEl.textContent = `${models.length} modelo(s) carregado(s) com sucesso!`; setStatusTone(statusEl, 'success'); }
            });
        });
    });

    // Copilot - Carregar Modelos
    document.getElementById('qualiflow-load-copilot-models')?.addEventListener('click', () => {
        const statusEl = document.getElementById('qualiflow-copilot-models-status');
        const selectEl = document.getElementById('qualiflow-settings-copilot-model');
        if (statusEl) { statusEl.textContent = 'Carregando...'; setStatusTone(statusEl, 'muted'); }
        sendRuntimeMessage({ action: RuntimeActions.GET_COPILOT_MODELS }, (response) => {
            if (response && response.error) {
                if (statusEl) { statusEl.textContent = `Erro: ${response.error}`; setStatusTone(statusEl, 'error'); }
                return;
            }
            const models = response?.models || [];
            if (!models.length) {
                if (statusEl) { statusEl.textContent = 'Nenhum modelo encontrado.'; setStatusTone(statusEl, 'warning'); }
                return;
            }
            const currentVal = selectEl.value;
            const allowedModels = models.filter((m) => VALID_COPILOT_MODELS.includes(m));
            if (!allowedModels.length) {
                if (statusEl) { statusEl.textContent = 'Nenhum modelo permitido foi retornado.'; setStatusTone(statusEl, 'warning'); }
                return;
            }

            selectEl.innerHTML = allowedModels.map(m => `<option value="${m}">${m}</option>`).join('');
            selectEl.value = normalizeCopilotModel(currentVal);
            if (statusEl) { statusEl.textContent = `${allowedModels.length} modelo(s) permitido(s) carregado(s)!`; setStatusTone(statusEl, 'success'); }
        });
    });

    // Groq - Carregar Modelos
    document.getElementById('qualiflow-load-groq-models')?.addEventListener('click', () => {
        const keyEl = document.getElementById('qualiflow-settings-groq-key');
        const statusEl = document.getElementById('qualiflow-groq-models-status');
        const selectEl = document.getElementById('qualiflow-settings-groq-model');
        if (!keyEl || !keyEl.value.trim()) {
            if (statusEl) { statusEl.textContent = 'Insira a API Key primeiro.'; setStatusTone(statusEl, 'error'); }
            return;
        }
        if (statusEl) { statusEl.textContent = 'Carregando...'; setStatusTone(statusEl, 'muted'); }
        setStorage({ groqKey: keyEl.value.trim() }, () => {
            sendRuntimeMessage({ action: RuntimeActions.GET_GROQ_MODELS }, (response) => {
                if (response && response.error) {
                    if (statusEl) { statusEl.textContent = `Erro: ${response.error}`; setStatusTone(statusEl, 'error'); }
                    return;
                }
                const models = response?.models || [];
                if (!models.length) {
                    if (statusEl) { statusEl.textContent = 'Nenhum modelo encontrado.'; setStatusTone(statusEl, 'warning'); }
                    return;
                }
                const currentVal = selectEl.value;
                selectEl.innerHTML = models.map(m => `<option value="${m}">${m}</option>`).join('');
                if (models.includes(currentVal)) selectEl.value = currentVal;
                if (statusEl) { statusEl.textContent = `${models.length} modelo(s) carregado(s) com sucesso!`; setStatusTone(statusEl, 'success'); }
            });
        });
    });

    document.getElementById('ui-btn-add-runner-project').onclick = () => {
        const nameInput = document.getElementById('ui-runner-new-name');
        const urlInput = document.getElementById('ui-runner-new-url');
        const name = nameInput.value.trim();
        const url = urlInput.value.trim();

        if (!name || !url) return;
        uiState.runnerProjects.push({ name, url });
        nameInput.value = '';
        urlInput.value = '';
        renderUIRunnerProjects();
        setStorage({ runnerProjects: uiState.runnerProjects });
    };

    const loginBtn = document.getElementById('qualiflow-copilot-login-btn');
    if (loginBtn) {
        loginBtn.onclick = () => {
            void startCopilotOAuthLoginUI();
        };
    }

    const azureLoginBtn = document.getElementById('qualiflow-azure-login-btn');
    if (azureLoginBtn) {
        azureLoginBtn.onclick = () => {
            void startBoardOAuthLoginUI('azure');
        };
    }

    const jiraLoginBtn = document.getElementById('qualiflow-jira-login-btn');
    if (jiraLoginBtn) {
        jiraLoginBtn.onclick = () => {
            void startBoardOAuthLoginUI('jira');
        };
    }

    const devModeToggle = document.getElementById('qualiflow-dev-mode-toggle');
    const backendUrlInput = document.getElementById('qualiflow-settings-copilot-backend-url');
    if (devModeToggle && backendUrlInput) {
        devModeToggle.onchange = () => {
            if (devModeToggle.checked) {
                backendUrlInput.value = DEV_BACKEND_URL;
            } else if (backendUrlInput.value.trim() === DEV_BACKEND_URL) {
                backendUrlInput.value = '';
            }
        };
    }
}
