import { buildDeployCharts, getDeployVisibleNodes, matchesDeployFilters, normalizeDeployText } from './deployFilters.js';
import { initMultiSelectDropdown } from './multiSelectDropdown.js';
import { openDeployExportModal } from './deployExportModal.js';
import { escapeHtml } from './helpers.js';

let deployDropdownDisposers = [];

export function renderDeployResults(cards, container, payload = null) {
    deployDropdownDisposers.forEach((dispose) => {
        try {
            dispose();
        } catch (_err) {
            // noop
        }
    });
    deployDropdownDisposers = [];

    container.innerHTML = '';

    if (cards.length === 0) {
        container.innerHTML = '<div class="qualiflow-empty">Nenhum card encontrado nesta sprint.</div>';
        return;
    }

    const flatCards = getDeployVisibleNodes(cards);
    const iterationPath = payload?.iterationPath || '';
    const resolvedSummary = payload?.summary || {
        total: flatCards.length,
        liberados: flatCards.filter(({ node }) => node.liberado === 'yes').length,
        problemas: flatCards.filter(({ node }) => node.liberado === 'no').length,
        pendentes: flatCards.filter(({ node }) => node.liberado === 'pending').length
    };

    const summaryBox = document.createElement('div');
    const approved = resolvedSummary.liberados || 0;
    const total = resolvedSummary.total || cards.length;
    summaryBox.innerHTML = `
        <div class="qualiflow-dep-panel qualiflow-dep-summary${approved === total ? ' is-ok' : ''}" aria-live="polite">
            <strong>${approved}/${total}</strong> cards liberados para deploy
            <span class="qualiflow-dep-summary-detail">
                (${resolvedSummary.problemas || 0} com problema, ${resolvedSummary.pendentes || 0} pendentes)
            </span>
        </div>
    `;
    container.appendChild(summaryBox);

    const ruleBox = document.createElement('div');
    ruleBox.className = 'qualiflow-dep-panel';
    ruleBox.innerHTML = `
        <div class="qualiflow-dep-panel-title">Regra usada na validação</div>
        <div>Conta como <strong>liberado</strong> quando existe stack, a tag <strong>Liberado deploy</strong> e a lógica do card pai/filho não cria bloqueio.</div>
        <div class="qualiflow-dep-panel-note">Task/Fix herdam o estado do PBI pai. Ocorrência em Done/Closed não entra na lista.</div>
    `;
    container.appendChild(ruleBox);

    const filterBox = document.createElement('div');
    filterBox.className = 'qualiflow-dep-panel';
    filterBox.innerHTML = `
        <div class="qualiflow-dep-filter-row">
            <div class="qualiflow-dep-filter-grid">
                <input id="qualiflow-deploy-search" type="text" class="qualiflow-input-edit" placeholder="Buscar por ID, nome, tipo, QA..." aria-label="Buscar cards" />
                <div id="qualiflow-deploy-filter-type" class="qualiflow-multi-select">
                    <button type="button" class="qualiflow-select-input qualiflow-multi-select-trigger" title="Selecione os tipos">
                        <span class="qualiflow-multi-select-label">Tipo: Todos</span>
                        <span class="qualiflow-multi-select-arrow">▼</span>
                    </button>
                    <div class="qualiflow-multi-select-panel"></div>
                </div>
                <select id="qualiflow-deploy-filter-state" class="qualiflow-select-input" aria-label="Filtrar por estado">
                    <option value="all">Todos os estados</option>
                </select>
                <div id="qualiflow-deploy-filter-qa" class="qualiflow-multi-select">
                    <button type="button" class="qualiflow-select-input qualiflow-multi-select-trigger" title="Selecione os QA">
                        <span class="qualiflow-multi-select-label">QA: Todos</span>
                        <span class="qualiflow-multi-select-arrow">▼</span>
                    </button>
                    <div class="qualiflow-multi-select-panel"></div>
                </div>
                <select id="qualiflow-deploy-filter-stack" class="qualiflow-select-input" aria-label="Filtrar por stack">
                    <option value="all">Toda stack</option>
                    <option value="front">Front</option>
                    <option value="back">Back</option>
                    <option value="tecnica">Técnica</option>
                    <option value="front+back">Front + Back</option>
                    <option value="none">Sem stack</option>
                </select>
                <select id="qualiflow-deploy-filter-release" class="qualiflow-select-input" aria-label="Filtrar por liberação">
                    <option value="all">Toda liberação</option>
                    <option value="yes">Liberado</option>
                    <option value="pending">Pendente</option>
                    <option value="no">Com problema</option>
                </select>
            </div>
            <button type="button" id="qualiflow-deploy-filter-clear" class="qualiflow-btn-inline qualiflow-btn-secondary">Limpar filtros</button>
        </div>
        <div id="qualiflow-deploy-filter-info" class="qualiflow-dep-filter-info" aria-live="polite"></div>
    `;
    container.appendChild(filterBox);

    const chartsBox = document.createElement('div');
    chartsBox.id = 'qualiflow-deploy-charts';
    chartsBox.className = 'qualiflow-dep-spaced';
    container.appendChild(chartsBox);

    const tableWrap = document.createElement('div');
    tableWrap.id = 'qualiflow-deploy-table-wrap';
    container.appendChild(tableWrap);

    const allNodes = flatCards;
    const allTypes = [...new Set(allNodes.map(({ node }) => node.type || 'Sem tipo'))].sort();
    const allStates = [...new Set(allNodes.map(({ node }) => node.effectiveState || node.state || 'Sem estado'))].sort();
    const allQa = [...new Set(allNodes.flatMap(({ node }) => node.qaResponsibles || []))].sort();

    const typeSelect = document.getElementById('qualiflow-deploy-filter-type');
    const stateSelect = document.getElementById('qualiflow-deploy-filter-state');
    const qaSelect = document.getElementById('qualiflow-deploy-filter-qa');
    const searchInput = document.getElementById('qualiflow-deploy-search');
    const stackSelect = document.getElementById('qualiflow-deploy-filter-stack');
    const releaseSelect = document.getElementById('qualiflow-deploy-filter-release');
    const clearBtn = document.getElementById('qualiflow-deploy-filter-clear');
    const infoEl = document.getElementById('qualiflow-deploy-filter-info');

    const typeMulti = initMultiSelectDropdown(typeSelect, {
        placeholder: 'Tipo',
        onChange: () => {
            filters.types = typeMulti?.getSelectedValues?.() || [];
            applyFilters();
        }
    });
    const qaMulti = initMultiSelectDropdown(qaSelect, {
        placeholder: 'QA',
        onChange: () => {
            filters.qaList = qaMulti?.getSelectedValues?.() || [];
            applyFilters();
        }
    });

    if (typeMulti?.destroy) deployDropdownDisposers.push(typeMulti.destroy);
    if (qaMulti?.destroy) deployDropdownDisposers.push(qaMulti.destroy);

    if (typeMulti) typeMulti.setOptions(allTypes);
    if (stateSelect) stateSelect.innerHTML += allStates.map(state => `<option value="${escapeHtml(normalizeDeployText(state))}">${escapeHtml(state)}</option>`).join('');
    if (qaMulti) qaMulti.setOptions(allQa);

    const filters = {
        search: '',
        types: [],
        state: 'all',
        qaList: [],
        stack: 'all',
        release: 'all'
    };

    let currentVisibleRows = flatCards;

    const renderTable = (rows) => {
        if (!rows.length) {
            tableWrap.innerHTML = '<div class="qualiflow-empty">Nenhum card corresponde aos filtros atuais.</div>';
            return;
        }

        const table = document.createElement('table');
        table.className = 'qualiflow-deploy-table';

        table.innerHTML = `
            <thead>
                <tr>
                    <th scope="col">ID</th>
                    <th scope="col">Card</th>
                    <th scope="col">Tipo</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Stack</th>
                    <th scope="col">QA</th>
                    <th scope="col">Tags</th>
                    <th scope="col">Liberação</th>
                    <th scope="col">Problemas</th>
                    <th scope="col">Ação</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;

        const tbody = table.querySelector('tbody');
        rows.forEach(({ node, depth }) => {
            const row = document.createElement('tr');
            row.className = `qualiflow-deploy-row${node.liberado === 'yes' ? ' qualiflow-deploy-row-ok' : node.liberado === 'no' ? ' qualiflow-deploy-row-problem' : ''}${depth > 0 ? ' qualiflow-deploy-row-child' : ''}`;

            const liberadoText = node.liberado === 'yes' ? 'Liberado' : node.liberado === 'pending' ? 'Pendente' : 'Com problema';
            const liberadoClass = node.liberado === 'yes' ? 'qualiflow-deploy-yes' : node.liberado === 'pending' ? 'qualiflow-deploy-pending' : 'qualiflow-deploy-no';
            const problemText = node.issues && node.issues.length > 0 ? escapeHtml(node.issues.join('; ')) : '—';
            const stackText = (node.stackTags && node.stackTags.length > 0) ? escapeHtml(node.stackTags.join(' + ')) : '—';
            const qaText = (node.qaResponsibles && node.qaResponsibles.length > 0) ? escapeHtml(node.qaResponsibles.join(', ')) : '—';
            const deployText = node.hasDeployTag ? 'Liberado deploy' : '—';
            const prefix = depth > 0 ? '↳ ' : '';
            const effectiveState = escapeHtml(node.effectiveState || node.state || '—');
            const actualState = escapeHtml(node.state || '—');
            const stateText = effectiveState === actualState ? effectiveState : `${effectiveState} <span class="qualiflow-dep-orig-state">(orig: ${actualState})</span>`;
            const tagsText = [deployText].filter(Boolean).join(' / ') || '—';

            row.innerHTML = `
                <td>#${escapeHtml(node.id)}</td>
                <td class="qualiflow-dep-card-cell" style="--depth:${depth};">${prefix}${escapeHtml(node.title)}</td>
                <td class="qualiflow-dep-muted-cell">${escapeHtml(node.type || '—')}</td>
                <td class="qualiflow-dep-muted-cell">${stateText}</td>
                <td class="qualiflow-dep-muted-cell">${stackText}</td>
                <td class="qualiflow-dep-muted-cell">${qaText}</td>
                <td class="qualiflow-dep-muted-cell">${tagsText}</td>
                <td><span class="qualiflow-deploy-badge ${liberadoClass}">${liberadoText}</span></td>
                <td class="qualiflow-dep-muted-cell">${problemText}</td>
                <td>
                    <a href="${escapeHtml(node.url || '#')}" target="_blank" rel="noopener noreferrer" class="qualiflow-btn-inline qualiflow-btn-secondary qualiflow-btn-sm qualiflow-dep-link">Abrir</a>
                </td>
            `;
            tbody.appendChild(row);
        });

        const scroller = document.createElement('div');
        scroller.className = 'qualiflow-deploy-table-wrap';
        scroller.appendChild(table);
        tableWrap.innerHTML = '';
        tableWrap.appendChild(scroller);
    };

    const exportBar = document.createElement('div');
    exportBar.className = 'qualiflow-dep-panel';
    exportBar.innerHTML = `
        <div class="qualiflow-dep-bar-row">
            <div>
                <div class="qualiflow-dep-panel-title">Exportar lista para Teams</div>
                <div class="qualiflow-dep-panel-note">Abre uma modal com filtros e saída formatada em tabela.</div>
            </div>
            <button type="button" id="qualiflow-open-export-modal" class="qualiflow-btn-inline qualiflow-btn-primary">Exportar</button>
        </div>
    `;
    container.appendChild(exportBar);

    const applyFilters = () => {
        const visible = allNodes.filter(({ node }) => matchesDeployFilters(node, filters));
        currentVisibleRows = visible;
        if (infoEl) {
            infoEl.textContent = `${visible.length} item(ns) visível(is) de ${allNodes.length} na sprint atual.`;
        }
        chartsBox.innerHTML = buildDeployCharts(visible);
        renderTable(visible);
    };

    if (searchInput) searchInput.addEventListener('input', (e) => { filters.search = e.target.value || ''; applyFilters(); });
    if (stateSelect) stateSelect.addEventListener('change', (e) => { filters.state = e.target.value; applyFilters(); });
    if (stackSelect) stackSelect.addEventListener('change', (e) => { filters.stack = e.target.value; applyFilters(); });
    if (releaseSelect) releaseSelect.addEventListener('change', (e) => { filters.release = e.target.value; applyFilters(); });
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            filters.search = '';
            filters.types = [];
            filters.state = 'all';
            filters.qaList = [];
            filters.stack = 'all';
            filters.release = 'all';
            if (searchInput) searchInput.value = '';
            if (typeMulti) typeMulti.setSelectedValues([]);
            if (stateSelect) stateSelect.value = 'all';
            if (qaMulti) qaMulti.setSelectedValues([]);
            if (stackSelect) stackSelect.value = 'all';
            if (releaseSelect) releaseSelect.value = 'all';
            applyFilters();
        });
    }

    const openExportBtn = document.getElementById('qualiflow-open-export-modal');
    if (openExportBtn) {
        openExportBtn.addEventListener('click', () => {
            openDeployExportModal({
                rows: currentVisibleRows,
                iterationPath
            });
        });
    }

    applyFilters();
}
