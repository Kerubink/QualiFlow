import { escapeHtml, getDashboardTypeStyle, getIterationLabel } from './helpers.js';
import { openTestCasesModal } from './testCasesModal.js';

let currentDashboardData = [];

export function renderDashboard(data) {
    currentDashboardData = data || [];
    const container = document.getElementById('qualiflow-dashboard-cards');
    if (!container) return;
    container.innerHTML = '';

    if (currentDashboardData.length === 0) {
        container.innerHTML = '<div class="qualiflow-empty" role="status">Nenhum card encontrado no board para o dashboard geral.</div>';
        return;
    }

    // Extract iterations
    const iterations = [...new Set(currentDashboardData.map(d => d.iterationPath))].sort();

    const header = document.createElement('div');
    header.className = 'qualiflow-dashboard-header qualiflow-dsh-section-lg';
    header.innerHTML = `
                <h3 class="qualiflow-dsh-title qualiflow-u-mb-2">Cards do Board (Dashboard Geral)</h3>
                    <div class="qualiflow-select-group qualiflow-dsh-sprint-filter">
                        <label for="qualiflow-dash-filter">Filtrar por Sprint/Iteration:</label>
                        <select id="qualiflow-dash-filter" class="qualiflow-select-input">
                            <option value="All">Todas as Iterations</option>
                            ${iterations.map(i => `<option value="${escapeHtml(i)}">${escapeHtml(i)}</option>`).join('')}
                        </select>
                    </div>
            `;

    const summaryContainer = document.createElement('div');
    summaryContainer.id = 'qualiflow-dash-summary';
    summaryContainer.className = 'qualiflow-dsh-summary';

    const list = document.createElement('div');
    list.id = 'qualiflow-dash-list';
    list.className = 'qualiflow-dsh-grid';

    container.appendChild(header);
    container.appendChild(summaryContainer);
    container.appendChild(list);

    const filterEl = document.getElementById('qualiflow-dash-filter');
    if (filterEl) {
        filterEl.addEventListener('change', () => drawDashCards(filterEl.value));
    }

    drawDashCards('All');
}
function drawDashCards(iteration) {
    const list = document.getElementById('qualiflow-dash-list');
    const summary = document.getElementById('qualiflow-dash-summary');
    list.innerHTML = '';

    const filtered = iteration === 'All'
        ? currentDashboardData
        : currentDashboardData.filter(d => d.iterationPath === iteration);

    if (filtered.length === 0) {
        list.innerHTML = '<p class="qualiflow-dsh-empty-text" role="status">Nenhum card nesta sprint.</p>';
        if (summary) summary.innerHTML = '';
        return;
    }

    // Populate Counters
    const counts = {};
    filtered.forEach(wi => {
        const style = getDashboardTypeStyle(wi.type);
        const key = style.label;
        if (!counts[key]) counts[key] = { count: 0, style: style, rawType: wi.type };
        counts[key].count++;
    });

    if (summary) {
        summary.innerHTML = Object.values(counts).map(c => `
            <div class="qualiflow-badge qualiflow-badge-${c.style.variant}">
                <span>${c.style.icon}</span>
                <span>${c.count} ${escapeHtml(c.rawType)}(s)</span>
            </div>
            `).join('');
    }

    filtered.forEach(wi => {
        const card = document.createElement('div');
        card.className = 'qualiflow-card qualiflow-dsh-item';

        const typeStyle = getDashboardTypeStyle(wi.type);

        const parentState = (wi.state || '').toLowerCase();
        const isParentDone = parentState === 'done' || parentState === 'teste ok' || parentState === 'closed';
        let hasPendingTest = false;

        const testCases = wi.testCases || [];
        testCases.forEach(tc => {
            const tcState = (tc.state || '').toLowerCase();
            if (tcState !== 'done' && tcState !== 'closed') {
                hasPendingTest = true;
            }
        });

        const warningIcon = (isParentDone && hasPendingTest)
            ? `<span class="qualiflow-dsh-warn" title="Aviso: PBI finalizado mas há testes pendentes!">⚠️</span>`
            : '';

        let testsInfoHtml = '';
        if (testCases.length > 0) {
            testsInfoHtml = `<div title="${testCases.length} Testes Associados"><strong>Testes:</strong> ${testCases.length} vinculado(s)</div>`;
        }

        card.innerHTML = `
            <div>
                <div class="qualiflow-dsh-item-title">#${escapeHtml(wi.id)} - ${escapeHtml(wi.title)} ${warningIcon}</div>
                <div class="qualiflow-dsh-item-meta">
                    <div class="qualiflow-dsh-item-row">
                        <span class="qualiflow-badge qualiflow-badge-${typeStyle.variant}">
                            ${typeStyle.icon} ${escapeHtml(wi.type)}
                        </span>
                        <span>${escapeHtml(wi.state)}</span>
                    </div>
                    <div title="${escapeHtml(wi.iterationPath || 'Desconhecido')}"><strong>Sprint:</strong> ${escapeHtml(getIterationLabel(wi.iterationPath))}</div>
                    ${testsInfoHtml}
                </div>
            </div>
            <div class="qualiflow-dsh-item-actions">
                <a href="${escapeHtml(wi.url)}" class="qualiflow-btn-inline qualiflow-btn-primary qualiflow-btn-sm">Abrir</a>
                ${testCases.length > 0 ? `<button type="button" class="qualiflow-btn-inline qualiflow-btn-secondary qualiflow-btn-sm btn-tests">Ver Testes</button>` : ''}
            </div>
        `;
        list.appendChild(card);

        if (testCases.length > 0) {
            const testsBtn = card.querySelector('.btn-tests');
            if (testsBtn) {
                testsBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    openTestCasesModal(testCases, wi.title);
                });
            }
        }
    });
}
