import { sendRuntimeMessage } from '../shared/runtime.js';
import { renderDeployResults } from './deployResults.js';
import { escapeHtml } from './helpers.js';
import { RuntimeActions } from '../../../contracts/runtimeActions.js';

export function renderDeployValidation() {
    const container = document.getElementById('qualiflow-dashboard-deploy');
    if (!container) return;
    container.innerHTML = '';

    const section = document.createElement('div');
    section.innerHTML = `
        <h3 class="qualiflow-dep-heading">Validar Deploy</h3>
        <div class="qualiflow-select-group qualiflow-dep-spaced">
            <label for="qualiflow-deploy-sprint-select">Sprint / Iteration:</label>
            <select id="qualiflow-deploy-sprint-select" class="qualiflow-select-input">
                <option value="">Carregando sprints...</option>
            </select>
        </div>
        <button type="button" id="qualiflow-deploy-validate-btn" class="qualiflow-btn qualiflow-btn-primary qualiflow-dep-spaced">Validar</button>
        <div id="qualiflow-deploy-results" aria-live="polite" style="display:none;"></div>
        <div id="qualiflow-deploy-loading" class="qualiflow-loading qualiflow-dep-loading" aria-live="polite" style="display:none;">Carregando...</div>
    `;
    container.appendChild(section);

    loadDeployIterations();
}

function loadDeployIterations() {
    const select = document.getElementById('qualiflow-deploy-sprint-select');
    if (!select) return;
    
    select.innerHTML = '<option value="">Carregando...</option>';
    select.disabled = true;

    sendRuntimeMessage({ action: RuntimeActions.GET_PROJECT_ITERATIONS }, (response) => {
        if (response && response.error) {
            select.innerHTML = `<option value="">Erro: ${escapeHtml(response.error)}</option>`;
            select.disabled = true;
            return;
        }

        const sprints = (response?.data || []).map(s => s.path || s);
        if (sprints.length === 0) {
            select.innerHTML = '<option value="">Nenhuma sprint encontrada</option>';
            select.disabled = true;
            return;
        }
        
        select.innerHTML = sprints.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s.split('\\').pop())}</option>`).join('');
        select.disabled = false;
    });
}

export function validateDeployCards() {
    const select = document.getElementById('qualiflow-deploy-sprint-select');
    const resultsDiv = document.getElementById('qualiflow-deploy-results');
    const loadingDiv = document.getElementById('qualiflow-deploy-loading');
    const validateBtn = document.getElementById('qualiflow-deploy-validate-btn');

    const iterationPath = select.value;
    if (!iterationPath) {
        alert('Selecione uma sprint antes de validar!');
        return;
    }

    validateBtn.disabled = true;
    validateBtn.textContent = 'Validando...';
    loadingDiv.style.display = 'block';
    resultsDiv.style.display = 'none';

    sendRuntimeMessage({
        action: RuntimeActions.GET_DEPLOY_VALIDATION,
        iterationPath: iterationPath
    }, (response) => {
        validateBtn.disabled = false;
        validateBtn.textContent = 'Validar';
        loadingDiv.style.display = 'none';

        if (response && response.error) {
            resultsDiv.innerHTML = `<div class="qualiflow-error-box" role="alert">Erro: ${escapeHtml(response.error)}</div>`;
            resultsDiv.style.display = 'block';
            return;
        }

        const payload = response?.data || {};
        const cards = Array.isArray(payload) ? payload : (payload.items || []);
        renderDeployResults(cards, resultsDiv, payload);
        resultsDiv.style.display = 'block';
    });
}
