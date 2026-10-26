import { sendRuntimeMessage } from '../shared/runtime.js';
import { dashboardState } from './state.js';
import { state } from '../state.js';
import { QaCharts } from './analyticsCharts.js';
import { OFFICIAL_TEST_PREFIXES, buildAnalyticsBars, escapeHtml, compareIterations, detectStackFromTags, extractQaLabel, extractTestPrefix, getIterationLabel, getSprintNumber, mapColorByIndex, normalizeAnalyticsToken, parseTagList, qfToken, toSortedEntries } from './helpers.js';
import { initMultiSelectDropdown } from './multiSelectDropdown.js';
import { RuntimeActions } from '../../../contracts/runtimeActions.js';

let analyticsDropdownDisposers = [];

export function renderAnalyticsDashboard(payload) {
    const container = document.getElementById('qualiflow-dashboard-analytics');
    if (!container) return;

    analyticsDropdownDisposers.forEach((dispose) => {
        try {
            dispose();
        } catch (_err) {
            // noop
        }
    });
    analyticsDropdownDisposers = [];

    const items = Array.isArray(payload) ? payload : (Array.isArray(payload?.items) ? payload.items : []);
    if (!items.length) {
        container.innerHTML = '<div class="qualiflow-empty" role="status">Nenhum Test Case disponível para análise.</div>';
        return;
    }

    const iterations = [...new Set(items.map((tc) => tc.iterationPath || tc.parentIterationPath).filter(Boolean))]
        .sort(compareIterations);

    const debugMeta = payload?.meta || state.dashboardMeta || null;

    container.innerHTML = `
        <div class="qualiflow-analytics-view">
            <div class="qualiflow-dsh-head">
                <div>
                    <h3 class="qualiflow-dsh-title">Analytics Pro de Testes e Cobertura</h3>
                    <div class="qualiflow-dsh-subtitle">Visão executiva por prefixo, stack, card pai e QA.</div>
                    ${debugMeta ? `<div class="qualiflow-dsh-meta">Fonte principal: pais=${debugMeta.parentCardsLoaded ?? '-'} | testes vinculados=${debugMeta.linkedTestsLoaded ?? '-'} | standalone=${debugMeta.standaloneTestsLoaded ?? '-'} | total=${debugMeta.totalItemsReturned ?? '-'}</div>` : ''}
                </div>
                <div class="qualiflow-analytics-filters">
                    <select id="qualiflow-analytics-filter-iteration" class="qualiflow-select-input" aria-label="Filtrar por iteration">
                        <option value="All">Todas as Iterations</option>
                        ${iterations.map((i) => `<option value="${i}">${getIterationLabel(i)}</option>`).join('')}
                    </select>
                    <select id="qualiflow-analytics-filter-stack" class="qualiflow-select-input" aria-label="Filtrar por stack">
                        <option value="all">Todos os stacks</option>
                        <option value="Front">Front</option>
                        <option value="Back">Back</option>
                        <option value="Tecnico">Tecnico</option>
                        <option value="Front + Back">Front + Back</option>
                        <option value="Nao classificado">Nao classificado</option>
                    </select>
                    <div id="qualiflow-analytics-filter-type" class="qualiflow-multi-select">
                        <button type="button" class="qualiflow-select-input qualiflow-multi-select-trigger" title="Selecione os Tipos de card" aria-label="Selecione os Tipos de card">
                            <span class="qualiflow-multi-select-label">Tipo: Todos</span>
                            <span class="qualiflow-multi-select-arrow">▼</span>
                        </button>
                        <div class="qualiflow-multi-select-panel"></div>
                    </div>
                    <div id="qualiflow-analytics-filter-prefix" class="qualiflow-multi-select">
                        <button type="button" class="qualiflow-select-input qualiflow-multi-select-trigger" title="Selecione os Prefixos de teste" aria-label="Selecione os Prefixos de teste">
                            <span class="qualiflow-multi-select-label">Prefixo: Todos</span>
                            <span class="qualiflow-multi-select-arrow">▼</span>
                        </button>
                        <div class="qualiflow-multi-select-panel"></div>
                    </div>
                    <div id="qualiflow-analytics-filter-qa" class="qualiflow-multi-select">
                        <button type="button" class="qualiflow-select-input qualiflow-multi-select-trigger" title="Selecione os QAs" aria-label="Selecione os QAs">
                            <span class="qualiflow-multi-select-label">QA: Todos</span>
                            <span class="qualiflow-multi-select-arrow">▼</span>
                        </button>
                        <div class="qualiflow-multi-select-panel"></div>
                    </div>
                    <select id="qualiflow-analytics-trend-start" class="qualiflow-select-input" aria-label="Tendência: iteration inicial">
                        <option value="all">Tendência: início (auto)</option>
                        ${iterations.map((i) => `<option value="${i}">${getIterationLabel(i)}</option>`).join('')}
                    </select>
                    <select id="qualiflow-analytics-trend-end" class="qualiflow-select-input" aria-label="Tendência: iteration final">
                        <option value="all">Tendência: fim (auto)</option>
                        ${iterations.map((i) => `<option value="${i}">${getIterationLabel(i)}</option>`).join('')}
                    </select>
                    <div id="qualiflow-analytics-heatmap-qa" class="qualiflow-multi-select">
                        <button type="button" class="qualiflow-select-input qualiflow-multi-select-trigger" title="Selecione os QAs para o Heatmap" aria-label="Selecione os QAs para o Heatmap">
                            <span class="qualiflow-multi-select-label">Heatmap QA: Todos</span>
                            <span class="qualiflow-multi-select-arrow">▼</span>
                        </button>
                        <div class="qualiflow-multi-select-panel"></div>
                    </div>
                    <div id="qualiflow-analytics-heatmap-prefix" class="qualiflow-multi-select">
                        <button type="button" class="qualiflow-select-input qualiflow-multi-select-trigger" title="Selecione os Prefixos para o Heatmap" aria-label="Selecione os Prefixos para o Heatmap">
                            <span class="qualiflow-multi-select-label">Heatmap Prefixo: Todos</span>
                            <span class="qualiflow-multi-select-arrow">▼</span>
                        </button>
                        <div class="qualiflow-multi-select-panel"></div>
                    </div>
                </div>
            </div>

            <div id="qualiflow-analytics-kpis" class="qualiflow-analytics-kpis"></div>

            <div class="qualiflow-analytics-grid">
                <div class="qualiflow-card qualiflow-analytics-card">
                    <div class="qualiflow-dsh-chart-title">Mix por prefixo (Donut)</div>
                    <div id="qualiflow-analytics-prefix-donut" class="qualiflow-analytics-plot"></div>
                </div>
                <div class="qualiflow-card qualiflow-analytics-card">
                    <div class="qualiflow-dsh-chart-title">Distribuição por stack (Donut)</div>
                    <div id="qualiflow-analytics-stack-donut" class="qualiflow-analytics-plot"></div>
                </div>
                <div class="qualiflow-card qualiflow-analytics-card qualiflow-analytics-card-wide">
                    <div class="qualiflow-dsh-chart-title">Tendência de Test Cases por iteration</div>
                    <div id="qualiflow-analytics-trend-line" class="qualiflow-analytics-plot"></div>
                </div>
                <div class="qualiflow-card qualiflow-analytics-card">
                    <div class="qualiflow-dsh-chart-title">Balanceamento de qualidade (Radar)</div>
                    <div id="qualiflow-analytics-quality-radar" class="qualiflow-analytics-plot"></div>
                </div>
                <div class="qualiflow-card qualiflow-analytics-card">
                    <div class="qualiflow-dsh-chart-title">Execução concluída (Gauge)</div>
                    <div id="qualiflow-analytics-execution-gauge" class="qualiflow-analytics-plot"></div>
                </div>
                <div class="qualiflow-card qualiflow-analytics-card qualiflow-analytics-card-wide">
                    <div class="qualiflow-dsh-chart-title">Heatmap QA x Prefixo</div>
                    <div id="qualiflow-analytics-qa-prefix-heatmap" class="qualiflow-analytics-plot"></div>
                </div>
            </div>

            <div class="qualiflow-analytics-grid qualiflow-analytics-grid-secondary">
                <div class="qualiflow-card qualiflow-analytics-card">
                    <div class="qualiflow-dsh-chart-title">Testes por card pai (Top tipos)</div>
                    <div id="qualiflow-analytics-parent-type-chart" class="qualiflow-analytics-plot"></div>
                </div>
                <div class="qualiflow-card qualiflow-analytics-card">
                    <div class="qualiflow-dsh-chart-title">Testes por QA (Top)</div>
                    <div id="qualiflow-analytics-qa-chart" class="qualiflow-analytics-plot"></div>
                </div>
            </div>

            <div id="qualiflow-analytics-table"></div>
        </div>
    `;

    const iterationFilter = document.getElementById('qualiflow-analytics-filter-iteration');
    const stackFilter = document.getElementById('qualiflow-analytics-filter-stack');
    const typeFilter = document.getElementById('qualiflow-analytics-filter-type');
    const prefixFilter = document.getElementById('qualiflow-analytics-filter-prefix');
    const qaFilter = document.getElementById('qualiflow-analytics-filter-qa');
    const trendStartFilter = document.getElementById('qualiflow-analytics-trend-start');
    const trendEndFilter = document.getElementById('qualiflow-analytics-trend-end');
    const heatmapQaFilter = document.getElementById('qualiflow-analytics-heatmap-qa');
    const heatmapPrefixFilter = document.getElementById('qualiflow-analytics-heatmap-prefix');
    const heatmapQaMulti = initMultiSelectDropdown(heatmapQaFilter, {
        placeholder: 'Heatmap QA',
        onChange: () => render()
    });
    const heatmapPrefixMulti = initMultiSelectDropdown(heatmapPrefixFilter, {
        placeholder: 'Heatmap Prefixo',
        onChange: () => render()
    });
    const typeMulti = initMultiSelectDropdown(typeFilter, {
        placeholder: 'Tipo',
        onChange: () => render()
    });
    const prefixMulti = initMultiSelectDropdown(prefixFilter, {
        placeholder: 'Prefixo',
        onChange: () => render()
    });
    const qaMulti = initMultiSelectDropdown(qaFilter, {
        placeholder: 'QA',
        onChange: () => render()
    });

    if (heatmapQaMulti?.destroy) analyticsDropdownDisposers.push(heatmapQaMulti.destroy);
    if (heatmapPrefixMulti?.destroy) analyticsDropdownDisposers.push(heatmapPrefixMulti.destroy);
    if (typeMulti?.destroy) analyticsDropdownDisposers.push(typeMulti.destroy);
    if (prefixMulti?.destroy) analyticsDropdownDisposers.push(prefixMulti.destroy);
    if (qaMulti?.destroy) analyticsDropdownDisposers.push(qaMulti.destroy);

    const render = () => {
        const selectedIteration = iterationFilter?.value || 'All';
        const selectedStack = stackFilter?.value || 'all';
        const selectedType = typeMulti?.getSelectedValues?.() || [];
        const selectedPrefix = prefixMulti?.getSelectedValues?.() || [];
        const selectedQa = qaMulti?.getSelectedValues?.() || [];
        const trendStart = trendStartFilter?.value || 'all';
        const trendEnd = trendEndFilter?.value || 'all';

        const casesByIteration = selectedIteration === 'All'
            ? items
            : items.filter((tc) => (tc.iterationPath || tc.parentIterationPath) === selectedIteration);

        const rows = casesByIteration.map((tc) => {
            const parentTags = parseTagList(tc.parentTags || '');
            const testTags = parseTagList(tc.tags || '');
            const mergedTags = [...parentTags, ...testTags];
            return {
                parentId: tc.parentId || `TC-${tc.id}`,
                parentTitle: tc.parentTitle || 'Sem card pai vinculado',
                parentType: tc.parentType || 'Sem tipo',
                parentState: tc.parentState || '',
                testId: tc.id,
                testTitle: tc.title || `Teste ${tc.id}`,
                testState: tc.state || 'Sem estado',
                testPrefix: extractTestPrefix(tc.title),
                iterationPath: tc.iterationPath || tc.parentIterationPath || 'Desconhecido',
                stack: detectStackFromTags(mergedTags),
                qa: extractQaLabel(parentTags, testTags, tc.assignedTo)
            };
        });

        const allTypes = [...new Set(rows.map((row) => row.parentType))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
        const dynamicPrefixes = [...new Set(rows.map((row) => row.testPrefix).filter((v) => v && v !== 'OUTROS'))]
            .sort((a, b) => a.localeCompare(b, 'pt-BR'));
        const allPrefixes = [...OFFICIAL_TEST_PREFIXES, ...dynamicPrefixes.filter((p) => !OFFICIAL_TEST_PREFIXES.includes(p)), 'OUTROS'];
        const allQa = [...new Set(rows.map((row) => row.qa))].sort((a, b) => a.localeCompare(b, 'pt-BR'));

        if (typeMulti) typeMulti.setOptions(allTypes);
        if (prefixMulti) prefixMulti.setOptions(allPrefixes);
        if (qaMulti) qaMulti.setOptions(allQa);

        if (heatmapQaMulti) heatmapQaMulti.setOptions(allQa);
        if (heatmapPrefixMulti) heatmapPrefixMulti.setOptions(allPrefixes);

        const filteredRows = rows.filter((row) => {
            if (selectedStack !== 'all' && row.stack !== selectedStack) return false;
            if (selectedType.length > 0 && !selectedType.includes(row.parentType)) return false;
            if (selectedPrefix.length > 0 && !selectedPrefix.includes(row.testPrefix)) return false;
            if (selectedQa.length > 0 && !selectedQa.includes(row.qa)) return false;
            return true;
        });

        const coveredParents = new Set(filteredRows.map((row) => row.parentId).filter((id) => !String(id).startsWith('TC-')));
        const totalParents = new Set(casesByIteration.map((tc) => tc.parentId).filter(Boolean)).size;
        const cardsWithTests = coveredParents.size;
        const cardCoverage = totalParents === 0 ? 0 : Math.round((cardsWithTests / totalParents) * 100);
        const totalTests = filteredRows.length;
        const doneTests = filteredRows.filter((row) => {
            const status = normalizeAnalyticsToken(row.testState);
            return status === 'done' || status === 'closed' || status === 'teste ok';
        }).length;
        const executionCoverage = totalTests === 0 ? 0 : Math.round((doneTests / totalTests) * 100);

        const kpis = document.getElementById('qualiflow-analytics-kpis');
        if (kpis) {
            kpis.innerHTML = `
                <div class="qualiflow-card qualiflow-dsh-kpi">
                    <div class="qualiflow-dsh-kpi-label">Test Cases analisados</div>
                    <div class="qualiflow-dsh-kpi-value">${totalTests}</div>
                </div>
                <div class="qualiflow-card qualiflow-dsh-kpi">
                    <div class="qualiflow-dsh-kpi-label">Cards pai mapeados</div>
                    <div class="qualiflow-dsh-kpi-value">${cardsWithTests}</div>
                </div>
                <div class="qualiflow-card qualiflow-dsh-kpi">
                    <div class="qualiflow-dsh-kpi-label">Cobertura por card</div>
                    <div class="qualiflow-dsh-kpi-value is-success">${cardCoverage}%</div>
                </div>
                <div class="qualiflow-card qualiflow-dsh-kpi">
                    <div class="qualiflow-dsh-kpi-label">Prefixos identificados</div>
                    <div class="qualiflow-dsh-kpi-value">${new Set(filteredRows.map((row) => row.testPrefix)).size}</div>
                </div>
                <div class="qualiflow-card qualiflow-dsh-kpi">
                    <div class="qualiflow-dsh-kpi-label">Execução concluída</div>
                    <div class="qualiflow-dsh-kpi-value is-sky">${executionCoverage}%</div>
                </div>
            `;
        }

        const prefixMap = new Map();
        const stackMap = new Map();
        const parentTypeMap = new Map();
        const qaMap = new Map();
        filteredRows.forEach((row) => {
            prefixMap.set(row.testPrefix, (prefixMap.get(row.testPrefix) || 0) + 1);
            stackMap.set(row.stack, (stackMap.get(row.stack) || 0) + 1);
            parentTypeMap.set(row.parentType, (parentTypeMap.get(row.parentType) || 0) + 1);
            qaMap.set(row.qa, (qaMap.get(row.qa) || 0) + 1);
        });

        const prefixTop = toSortedEntries(prefixMap, 10).map((item, idx) => ({ ...item, color: mapColorByIndex(idx) }));
        const stackTop = toSortedEntries(stackMap, 8).map((item, idx) => ({ ...item, color: mapColorByIndex(idx + 2) }));
        const parentTypeTop = toSortedEntries(parentTypeMap, 8);
        const qaTop = toSortedEntries(qaMap, 10);

        const prefixDonut = document.getElementById('qualiflow-analytics-prefix-donut');
        const stackDonut = document.getElementById('qualiflow-analytics-stack-donut');
        const trendLine = document.getElementById('qualiflow-analytics-trend-line');
        const qualityRadar = document.getElementById('qualiflow-analytics-quality-radar');
        const executionGauge = document.getElementById('qualiflow-analytics-execution-gauge');
        const qaPrefixHeatmap = document.getElementById('qualiflow-analytics-qa-prefix-heatmap');

        const parentTypeChart = document.getElementById('qualiflow-analytics-parent-type-chart');
        const qaChart = document.getElementById('qualiflow-analytics-qa-chart');

        if (QaCharts) {
            QaCharts.donut(prefixDonut, prefixTop, { caption: 'test cases' });
            QaCharts.donut(stackDonut, stackTop, { caption: 'stack' });
            QaCharts.gauge(executionGauge, executionCoverage, 'done/closed');

            const byIterationMap = new Map();
            filteredRows.forEach((row) => {
                const key = getIterationLabel(row.iterationPath || 'Desconhecido');
                byIterationMap.set(key, (byIterationMap.get(key) || 0) + 1);
            });

            let trendPoints = [...byIterationMap.entries()]
                .map(([label, value]) => ({ label, value }))
                .sort((a, b) => compareIterations(a.label, b.label));

            if (trendStart !== 'all' || trendEnd !== 'all') {
                const minN = trendStart !== 'all' ? getSprintNumber(trendStart) : null;
                const maxN = trendEnd !== 'all' ? getSprintNumber(trendEnd) : null;

                if (minN !== null || maxN !== null) {
                    const startBound = minN !== null ? minN : Number.MIN_SAFE_INTEGER;
                    const endBound = maxN !== null ? maxN : Number.MAX_SAFE_INTEGER;
                    const lower = Math.min(startBound, endBound);
                    const upper = Math.max(startBound, endBound);
                    trendPoints = trendPoints.filter((p) => {
                        const n = getSprintNumber(p.label);
                        if (n === null) return false;
                        return n >= lower && n <= upper;
                    });
                }
            }

            QaCharts.line(trendLine, trendPoints, { color: qfToken('--qf-info-strong', '#60a5fa') });

            const radarData = prefixTop.slice(0, 6);
            QaCharts.radar(qualityRadar, radarData);

            const selectedHeatmapQa = heatmapQaMulti?.getSelectedValues?.() || [];
            const selectedHeatmapPrefix = heatmapPrefixMulti?.getSelectedValues?.() || [];

            const qaRows = (selectedHeatmapQa.length > 0 ? selectedHeatmapQa : allQa).slice(0, 20);
            const prefixCols = (selectedHeatmapPrefix.length > 0 ? selectedHeatmapPrefix : allPrefixes).slice(0, 20);
            const matrix = qaRows.map((qa) => {
                return prefixCols.map((prefix) => {
                    return filteredRows.filter((r) => r.qa === qa && r.testPrefix === prefix).length;
                });
            });
            QaCharts.heatmap(qaPrefixHeatmap, qaRows, prefixCols, matrix);
        } else {
            if (prefixDonut) prefixDonut.innerHTML = buildAnalyticsBars(prefixTop, totalTests);
            if (stackDonut) stackDonut.innerHTML = buildAnalyticsBars(stackTop, totalTests);
            if (trendLine) trendLine.innerHTML = '<div class="qualiflow-empty qualiflow-dsh-empty" role="status">Biblioteca visual indisponível.</div>';
            if (qualityRadar) qualityRadar.innerHTML = '<div class="qualiflow-empty qualiflow-dsh-empty" role="status">Biblioteca visual indisponível.</div>';
            if (executionGauge) executionGauge.innerHTML = `<div class="qualiflow-dsh-gauge-text">${executionCoverage}% concluído</div>`;
            if (qaPrefixHeatmap) qaPrefixHeatmap.innerHTML = '<div class="qualiflow-empty qualiflow-dsh-empty" role="status">Biblioteca visual indisponível.</div>';
        }

        if (parentTypeChart) parentTypeChart.innerHTML = buildAnalyticsBars(parentTypeTop, totalTests);
        if (qaChart) qaChart.innerHTML = buildAnalyticsBars(qaTop, totalTests);

        const byParent = new Map();
        filteredRows.forEach((row) => {
            const key = `${row.parentId}`;
            if (!byParent.has(key)) {
                byParent.set(key, {
                    parentId: row.parentId,
                    parentTitle: row.parentTitle,
                    parentType: row.parentType,
                    tests: 0,
                    done: 0
                });
            }
            const ref = byParent.get(key);
            ref.tests += 1;
            const status = normalizeAnalyticsToken(row.testState);
            if (status === 'done' || status === 'closed' || status === 'teste ok') ref.done += 1;
        });

        const ranking = [...byParent.values()]
            .sort((a, b) => b.tests - a.tests)
            .slice(0, 12);

        const tableEl = document.getElementById('qualiflow-analytics-table');
        if (tableEl) {
            tableEl.innerHTML = `
                <div class="qualiflow-dsh-table-card">
                    <div class="qualiflow-dsh-table-title">Top cards por volume de testes</div>
                    <div class="qualiflow-dsh-table-scroll">
                        <div class="qualiflow-table-wrap">
                        <table class="qualiflow-table">
                            <thead>
                                <tr>
                                    <th scope="col">Card</th>
                                    <th scope="col">Tipo pai</th>
                                    <th scope="col">Qtd Testes</th>
                                    <th scope="col">Done</th>
                                    <th scope="col">Cobertura execução</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${ranking.map((row) => {
                const percent = row.tests === 0 ? 0 : Math.round((row.done / row.tests) * 100);
                return `
                                        <tr>
                                            <td>#${escapeHtml(row.parentId)} - ${escapeHtml(row.parentTitle)}</td>
                                            <td>${escapeHtml(row.parentType)}</td>
                                            <td class="qualiflow-dsh-num">${row.tests}</td>
                                            <td class="qualiflow-dsh-num is-success">${row.done}</td>
                                            <td class="qualiflow-dsh-num is-sky">${percent}%</td>
                                        </tr>
                                    `;
            }).join('')}
                            </tbody>
                        </table>
                        </div>
                    </div>
                </div>
            `;
        }
    };

    [iterationFilter, stackFilter, trendStartFilter, trendEndFilter]
        .filter(Boolean)
        .forEach((el) => el.addEventListener('change', render));

    render();
}

export function loadAnalyticsDashboardData() {
    const container = document.getElementById('qualiflow-dashboard-analytics');
    if (!container) return;
    container.innerHTML = '<div class="qualiflow-loading" role="status" aria-live="polite">Carregando Test Cases de todas as sprints/iterations...</div>';

    sendRuntimeMessage({ action: RuntimeActions.GET_TEST_CASE_ANALYTICS }, (response) => {
        if (response?.error) {
            container.innerHTML = `<div class="qualiflow-error-box" role="alert">Erro ao carregar analytics de Test Case: ${escapeHtml(response.error)}</div>`;
            return;
        }

        dashboardState.analyticsData = response?.data || { items: [] };
        renderAnalyticsDashboard(dashboardState.analyticsData);
    });
}
