// Carregamento (restore) e salvamento (save) do formulario de configuracoes.
import { DEFAULT_BACKEND_URL, normalizeCopilotModel, normalizeSelectedAi } from '../../domain/constants.js';
import { parseBackendUrl } from '../../domain/backendUrl.js';
import {
    getAzureOrgValue, getAzureProjectValue, loadAzureOrganizations,
    populateAzureOrgSelect, populateAzureProjectSelect
} from './azureDiscovery.js';
import { getStorage, setStorage } from './messaging.js';
import { renderRunnerProjects, runnerState } from './runnerProjects.js';
import { setBoardAuthStatus, setCopilotAuthStatus, showStatus } from './ui.js';

// Define o valor de um select de modelo, criando a opcao se ela ainda nao existir.
function setSelectValueEnsuringOption(selectEl, value) {
    const found = Array.from(selectEl.options).some(o => o.value === value);
    if (!found) {
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = value;
        selectEl.appendChild(opt);
    }
    selectEl.value = value;
}

export function saveOptions(e) {
    e.preventDefault();

    // General fields
    const qaEmail = document.getElementById('qa-email').value.trim();
    const qaTag = document.getElementById('qa-tag').value.trim();

    // Selections
    const selectedBoard = document.getElementById('board-select').value;
    const selectedAi = document.getElementById('ai-select').value;

    // Azure Fields
    const azureOrg = getAzureOrgValue();
    const azureProject = getAzureProjectValue();
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
    const parsedCopilotBackend = parseBackendUrl(document.getElementById('copilot-backend-url')?.value);
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
            runnerProjects: runnerState.projects, runnerEnabled: true
        },
        () => {
            showStatus('Configurações salvas com sucesso!', 'success');
        }
    );
}

export function restoreOptions() {
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
                aiSelect.value = normalizeSelectedAi(items.selectedAi);
                aiSelect.dispatchEvent(new Event('change'));
            }

            // Azure: mostra o valor salvo como placeholder ate a lista real ser buscada (ou ficar
            // como esta, em modo manual, se nao houver sessao para atualizar).
            populateAzureOrgSelect(items.azureOrg ? [{ url: items.azureOrg, name: items.azureOrg }] : [], items.azureOrg);
            populateAzureProjectSelect(items.azureProject ? [{ id: items.azureProject, name: items.azureProject }] : [], items.azureProject);
            if (items.supportWebhookUrl) document.getElementById('support-webhook-url').value = items.supportWebhookUrl;
            setBoardAuthStatus('azure', items.azureSessionToken ? 'Sessao OAuth carregada.' : 'Nao autenticado.', items.azureSessionToken ? 'success' : 'info');
            if (items.azureSessionToken) {
                loadAzureOrganizations(items.azureOrg, items.azureProject);
            }

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
                setSelectValueEnsuringOption(document.getElementById('gemini-model'), items.geminiModel);
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
                copilotBackendUrlInput.value = items.copilotBackendUrl || DEFAULT_BACKEND_URL;
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
                setSelectValueEnsuringOption(document.getElementById('groq-model'), items.groqModel);
            }

            // Runner Projects
            runnerState.projects = items.runnerProjects || [];
            renderRunnerProjects();
        }
    );
}
