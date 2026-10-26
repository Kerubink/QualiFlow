import { sendRuntimeMessage, getStorage, setStorage } from '../shared/runtime.js';
import { uiState } from './uiState.js';
import { escapeHtml } from '../dashboard/helpers.js';
import { RuntimeActions } from '../../../contracts/runtimeActions.js';

export function loadRunnerCards(query = '') {
    const list = document.getElementById('qualiflow-runner-cards-list');
    if (!list) return;

    list.setAttribute('aria-live', 'polite');
    list.innerHTML = '<div class="qualiflow-loading">Buscando itens de trabalho associados a testes, aguarde...</div>';

    sendRuntimeMessage({ action: RuntimeActions.GET_TEST_RUNNER_CARDS, query }, (response) => {
        if (!response || response.error) {
            list.innerHTML = `<div class="qualiflow-error-box" role="alert">Erro: ${escapeHtml(response?.error || 'Desconhecido')}</div>`;
            return;
        }

        uiState.runnerCardsData = response.data || [];
        setupRunnerFilters();
        drawRunnerCards('All');
    });
}

function setupRunnerFilters() {
    const filterEl = document.getElementById('qualiflow-runner-filter');
    if (!filterEl) return;
    const iterations = [...new Set(uiState.runnerCardsData.map(d => d.iterationPath))].sort();

    filterEl.innerHTML = '<option value="All">Todas as Iterations</option>' +
        iterations.map(i => `<option value="${escapeHtml(i)}">${escapeHtml(i)}</option>`).join('');

    // Remove old listener if exists to prevent duplicates
    const newFilterEl = filterEl.cloneNode(true);
    filterEl.replaceWith(newFilterEl);

    newFilterEl.addEventListener('change', () => {
        drawRunnerCards(newFilterEl.value);
    });
}

function drawRunnerCards(iteration) {
    const list = document.getElementById('qualiflow-runner-cards-list');
    if (!list) return;

    const filtered = iteration === 'All'
        ? uiState.runnerCardsData
        : uiState.runnerCardsData.filter(d => d.iterationPath === iteration);

    if (filtered.length === 0) {
        list.innerHTML = '<div class="qualiflow-empty">Nenhum card com testes encontrado nesta visualização.</div>';
        return;
    }

    list.innerHTML = '';

    // Simple mock of getDashboardTypeStyle since we don't import dashboard.js here
    const getTypeStyle = (type) => {
        const t = (type || '').toLowerCase();
        if (t.includes('bug')) return { icon: '🐞', variant: 'danger' };
        if (t.includes('story') || t.includes('pbi')) return { icon: '📘', variant: 'info' };
        if (t.includes('task')) return { icon: '📋', variant: 'warning' };
        if (t.includes('feature')) return { icon: '🏆', variant: 'success' };
        return { icon: '📄', variant: 'neutral' };
    };

    filtered.forEach(card => {
        const itemBody = document.createElement('div');
        itemBody.className = 'qualiflow-card qualiflow-card-raised qualiflow-run-card';

        const typeStyle = getTypeStyle(card.type);

        itemBody.innerHTML = `
            <div>
                <div class="qualiflow-run-card-title">#${escapeHtml(card.id)} - ${escapeHtml(card.title)}</div>
                <div class="qualiflow-run-card-meta">
                    <div class="qualiflow-run-card-row">
                        <span class="qualiflow-badge qualiflow-badge-${typeStyle.variant}">
                            ${typeStyle.icon} ${escapeHtml(card.type)}
                        </span>
                        <span>${escapeHtml(card.state)}</span>
                    </div>
                    <div title="${escapeHtml(card.iterationPath)}"><strong>Sprint:</strong> ${escapeHtml(card.iterationPath.split('\\').pop() || card.iterationPath)}</div>
                </div>
            </div>
            <div class="qualiflow-run-card-foot">
                <button type="button" class="qualiflow-btn-run-target qualiflow-btn-inline qualiflow-btn-primary qualiflow-btn-sm qualiflow-u-grow">▶ Run (Target)</button>
            </div>
        `;

        const runBtn = itemBody.querySelector('.qualiflow-btn-run-target');
        runBtn.addEventListener('click', () => {
            promptTargetUrlForRun(card);
        });

        list.appendChild(itemBody);
    });
}

function promptTargetUrlForRun(card) {
    const body = document.getElementById('qualiflow-runner-body');
    // Save current content to restore if cancelled
    const backupHtml = body.innerHTML;

    body.innerHTML = `
        <div class="qualiflow-run-heading-rule">
            Selecionar Alvo para Execução
        </div>
        <div class="qualiflow-run-lead">
            Work Item: <strong>#${escapeHtml(card.id)} - ${escapeHtml(card.title)}</strong>
        </div>
        <div id="qualiflow-runner-target-list" class="qualiflow-run-target-list" aria-live="polite">
            <div class="qualiflow-loading">Carregando projetos...</div>
        </div>
        <div class="qualiflow-run-target-footer">
            <button type="button" id="qualiflow-runner-cancel-target" class="qualiflow-btn-inline qualiflow-btn-secondary">Voltar</button>
        </div>
    `;

    document.getElementById('qualiflow-runner-cancel-target').addEventListener('click', () => {
        body.innerHTML = backupHtml;
        // Re-attach listeners to search since we overrode innerHTML
        document.getElementById('qualiflow-runner-search-btn').addEventListener('click', () => {
            loadRunnerCards(document.getElementById('qualiflow-runner-search').value.trim());
        });
        document.getElementById('qualiflow-runner-search').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') loadRunnerCards(e.target.value.trim());
        });
        // We need to re-render the cards because we replaced the DOM
        loadRunnerCards(document.getElementById('qualiflow-runner-search').value.trim());
    });

    const targetList = document.getElementById('qualiflow-runner-target-list');
    getStorage(['runnerProjects'], (data) => {
        const projs = data.runnerProjects || [];
        targetList.innerHTML = '';

        if (projs.length === 0) {
            targetList.innerHTML = '<div class="qualiflow-error-box" role="alert">Nenhum projeto alvo cadastrado. Vá em Configurações > Test Runner (URLs).</div>';
            return;
        }

        projs.forEach(p => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'qualiflow-card qualiflow-card-raised qualiflow-card-interactive qualiflow-run-target-btn';

            btn.innerHTML = `
                <span class="qualiflow-run-target-name">${escapeHtml(p.name)}</span>
                <span class="qualiflow-run-target-url">${escapeHtml(p.url)}</span>
            `;

            btn.addEventListener('click', () => {
                // Save the active runner session to chrome.storage so runner.js on the target page can read it
                const session = {
                    workItemId: card.id,
                    workItemTitle: card.title,
                    workItemType: card.type,
                    projectName: p.name,
                    targetUrl: p.url,
                    timestamp: Date.now()
                };
                setStorage({ runnerActiveSession: session }, () => {
                    window.open(p.url, '_blank');
                });
            });

            targetList.appendChild(btn);
        });
    });
}
