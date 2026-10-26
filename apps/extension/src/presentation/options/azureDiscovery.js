// Azure DevOps: auto-discovery de organizacao/projeto (apos login Microsoft).
import { normalizeAzureOrgUrl } from '../../domain/optionsSelection.js';
import { sendRuntimeMessage } from './messaging.js';
import { setStatusText } from './ui.js';
import { RuntimeActions } from '../../contracts/runtimeActions.js';

const AZURE_MANUAL_VALUE = '__manual__';

export function toggleAzureManualInput(kind) {
    const selectEl = document.getElementById(`azure-${kind}`);
    const manualEl = document.getElementById(`azure-${kind}-manual`);
    if (!selectEl || !manualEl) return;
    manualEl.classList.toggle('hidden', selectEl.value !== AZURE_MANUAL_VALUE);
}

export function getAzureOrgValue() {
    const selectEl = document.getElementById('azure-org');
    if (!selectEl) return '';
    const raw = selectEl.value === AZURE_MANUAL_VALUE
        ? (document.getElementById('azure-org-manual')?.value || '')
        : selectEl.value;
    return normalizeAzureOrgUrl(raw);
}

export function getAzureProjectValue() {
    const selectEl = document.getElementById('azure-project');
    if (!selectEl) return '';
    if (selectEl.value === AZURE_MANUAL_VALUE) {
        return (document.getElementById('azure-project-manual')?.value || '').trim();
    }
    return selectEl.value;
}

export function populateAzureOrgSelect(organizations, savedValue) {
    const selectEl = document.getElementById('azure-org');
    if (!selectEl) return;

    const options = organizations.map((org) => `<option value="${org.url}">${org.name}</option>`).join('');
    selectEl.innerHTML = `<option value="">Selecione uma organização...</option>${options}<option value="${AZURE_MANUAL_VALUE}">Outro (digitar manualmente)</option>`;

    const normalizedSaved = normalizeAzureOrgUrl(savedValue);
    const matched = normalizedSaved && organizations.some((org) => org.url === normalizedSaved);

    if (matched) {
        selectEl.value = normalizedSaved;
    } else if (normalizedSaved) {
        // A organizacao salva nao apareceu na lista (ex.: escopo/permissao diferente) -- preserva
        // o valor via modo manual em vez de descarta-lo silenciosamente.
        selectEl.value = AZURE_MANUAL_VALUE;
        const manualInput = document.getElementById('azure-org-manual');
        if (manualInput) manualInput.value = normalizedSaved;
    }
    toggleAzureManualInput('org');
}

export function populateAzureProjectSelect(projects, savedValue) {
    const selectEl = document.getElementById('azure-project');
    if (!selectEl) return;

    const options = projects.map((project) => `<option value="${project.name}">${project.name}</option>`).join('');
    selectEl.innerHTML = `<option value="">Selecione um projeto...</option>${options}<option value="${AZURE_MANUAL_VALUE}">Outro (digitar manualmente)</option>`;

    const normalizedSaved = (savedValue || '').trim();
    const matched = normalizedSaved && projects.some((project) => project.name === normalizedSaved);

    if (matched) {
        selectEl.value = normalizedSaved;
    } else if (normalizedSaved) {
        selectEl.value = AZURE_MANUAL_VALUE;
        const manualInput = document.getElementById('azure-project-manual');
        if (manualInput) manualInput.value = normalizedSaved;
    }
    toggleAzureManualInput('project');
}

export function loadAzureOrganizations(savedOrgValue, savedProjectValue) {
    const statusEl = document.getElementById('azure-orgs-status');
    const btn = document.getElementById('refresh-azure-orgs-btn');
    if (btn) btn.disabled = true;
    setStatusText(statusEl, 'Carregando organizações...', 'info');

    sendRuntimeMessage({ action: RuntimeActions.GET_AZURE_ORGANIZATIONS }, (response) => {
        if (btn) btn.disabled = false;

        if (!response?.success) {
            setStatusText(statusEl, `Erro: ${response?.error || 'falha ao carregar organizações'}`, 'error');
            return;
        }

        const organizations = response.organizations || [];
        populateAzureOrgSelect(organizations, savedOrgValue ?? getAzureOrgValue());

        setStatusText(
            statusEl,
            organizations.length
                ? `${organizations.length} organização(ões) encontrada(s).`
                : 'Nenhuma organização encontrada nesta conta Microsoft.',
            organizations.length ? 'success' : 'warn'
        );

        const currentOrg = getAzureOrgValue();
        if (currentOrg) loadAzureProjects(currentOrg, savedProjectValue);
    });
}

export function loadAzureProjects(orgUrl, savedProjectValue) {
    const statusEl = document.getElementById('azure-projects-status');
    const btn = document.getElementById('refresh-azure-projects-btn');

    if (!orgUrl) {
        setStatusText(statusEl, 'Selecione uma organização primeiro.', 'warn');
        return;
    }

    if (btn) btn.disabled = true;
    setStatusText(statusEl, 'Carregando projetos...', 'info');

    sendRuntimeMessage({ action: RuntimeActions.GET_AZURE_PROJECTS, orgUrl }, (response) => {
        if (btn) btn.disabled = false;

        if (!response?.success) {
            setStatusText(statusEl, `Erro: ${response?.error || 'falha ao carregar projetos'}`, 'error');
            return;
        }

        const projects = response.projects || [];
        populateAzureProjectSelect(projects, savedProjectValue ?? getAzureProjectValue());

        setStatusText(
            statusEl,
            projects.length
                ? `${projects.length} projeto(s) encontrado(s).`
                : 'Nenhum projeto encontrado nesta organização.',
            projects.length ? 'success' : 'warn'
        );
    });
}
