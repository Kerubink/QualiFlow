function getDashboardTypeStyle(type) {
    const t = (type || '').toLowerCase();
    if (t.includes('bug')) return { icon: '🐞', color: '#ef4444', label: 'Bug' }; // red
    if (t.includes('story') || t.includes('product backlog item') || t.includes('pbi')) return { icon: '📘', color: '#3b82f6', label: 'PBI' }; // blue
    if (t.includes('task')) return { icon: '📋', color: '#f59e0b', label: 'Task' }; // yellow
    if (t.includes('epic')) return { icon: '👑', color: '#8b5cf6', label: 'Epic' }; // purple
    if (t.includes('feature')) return { icon: '🏆', color: '#10b981', label: 'Feature' }; // green
    return { icon: '📄', color: '#94a3b8', label: type || 'Item' }; // fallback
}

function getIterationLabel(value) {
    const raw = String(value || 'Desconhecido');
    return raw.split('\\').pop() || raw;
}
function openTestCasesModal(testCases, pbiTitle) {
    document.getElementById('tests-modal-title').textContent = `Testes: ${pbiTitle}`;
    const body = document.getElementById('qualiflow-tests-body');
    body.innerHTML = '';

    if (!testCases || testCases.length === 0) {
        body.innerHTML = '<div class="qualiflow-info">Nenhum teste ligado a este card.</div>';
    } else {
        // TOP CONTROL BAR
        const controlsDiv = document.createElement('div');
        controlsDiv.className = 'qualiflow-tests-controls';
        controlsDiv.style.marginBottom = '20px';
        controlsDiv.style.padding = '12px';
        controlsDiv.style.backgroundColor = '#0f172a';
        controlsDiv.style.borderRadius = '6px';
        controlsDiv.style.border = '1px solid #334155';

        controlsDiv.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <input type="checkbox" id="qualiflow-tests-checkall" class="qualiflow-chk qualiflow-chk-large" />
                    <label for="qualiflow-tests-checkall" style="font-weight:600; cursor:pointer;">Selecionar Todos</label>
                </div>
                <span id="tests-selected-count" style="font-size:0.8rem; color:#94a3b8;">0 selecionados</span>
            </div>
            <div style="display:flex; gap:8px;">
                <select id="tests-new-state" class="qualiflow-select-input" style="flex:1;">
                    <option value="Novo">Novo</option>
                    <option value="Em teste">Em teste</option>
                    <option value="Done">Done</option>
                </select>
                <button id="tests-btn-update" class="qualiflow-btn qualiflow-btn-primary" style="margin:0; width:auto; padding:8px 16px;">Atualizar Status</button>
            </div>
            <div id="tests-update-feedback" class="qualiflow-hidden" style="margin-top:8px; font-size:0.8rem;"></div>
        `;
        body.appendChild(controlsDiv);

        const listDiv = document.createElement('div');
        listDiv.id = 'qualiflow-tests-list';
        body.appendChild(listDiv);

        testCases.forEach(tc => {
            const tcStateLower = (tc.state || '').toLowerCase();
            const stateColor = (tcStateLower === 'done' || tcStateLower === 'closed') ? '#10b981' : '#f59e0b';
            const tcEl = document.createElement('div');
            tcEl.className = 'qualiflow-acc-item test-item';
            tcEl.style.padding = '12px';
            tcEl.style.marginBottom = '8px';
            tcEl.style.display = 'flex';
            tcEl.style.alignItems = 'center';
            tcEl.style.gap = '12px';
            tcEl.dataset.id = tc.id;

            tcEl.innerHTML = `
                <input type="checkbox" class="qualiflow-chk test-chk" value="${tc.id}" />
                <div style="flex:1;">
                    <div style="font-weight:600; color:#e2e8f0; margin-bottom:6px;">[ID ${tc.id}] ${tc.title}</div>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span class="test-state-badge" style="font-size:0.75rem; background-color:${stateColor}20; color:${stateColor}; padding:2px 6px; border-radius:4px; font-weight:600; border: 1px solid ${stateColor}40;">Estado: <span class="state-val">${tc.state}</span></span>
                        <a href="${tc.url}" target="_blank" class="qualiflow-btn-inline qualiflow-btn-secondary" style="text-decoration:none; padding:4px 8px; font-size:0.7rem;">Abrir Azure</a>
                    </div>
                </div>
            `;
            listDiv.appendChild(tcEl);
        });

        // Event Listeners for checkboxes
        const checkAll = document.getElementById('qualiflow-tests-checkall');
        const chks = listDiv.querySelectorAll('.test-chk');
        const countSpan = document.getElementById('tests-selected-count');
        const btnUpdate = document.getElementById('tests-btn-update');
        const newStateSel = document.getElementById('tests-new-state');
        const feedback = document.getElementById('tests-update-feedback');

        const updateCount = () => {
            const selected = listDiv.querySelectorAll('.test-chk:checked').length;
            countSpan.textContent = `${selected} selecionado(s)`;
        };

        checkAll.addEventListener('change', (e) => {
            chks.forEach(c => c.checked = e.target.checked);
            updateCount();
        });

        chks.forEach(c => c.addEventListener('change', () => {
            checkAll.checked = (listDiv.querySelectorAll('.test-chk:checked').length === chks.length);
            updateCount();
        }));

        btnUpdate.addEventListener('click', () => {
            const selectedIds = Array.from(listDiv.querySelectorAll('.test-chk:checked')).map(c => parseInt(c.value));
            if (selectedIds.length === 0) {
                feedback.textContent = 'Selecione pelo menos um teste.';
                feedback.className = 'qualiflow-error';
                feedback.classList.remove('qualiflow-hidden');
                return;
            }

            const stateVal = newStateSel.value;
            btnUpdate.disabled = true;
            btnUpdate.textContent = 'Aguarde...';
            feedback.classList.add('qualiflow-hidden');

            sendRuntimeMessage({
                action: "UPDATE_WORK_ITEMS_STATE",
                ids: selectedIds,
                newState: stateVal
            }, (res) => {
                btnUpdate.disabled = false;
                btnUpdate.textContent = 'Atualizar Status';
                if (res && res.error) {
                    feedback.textContent = `Erro: ${res.error}`;
                    feedback.className = 'qualiflow-error';
                    feedback.classList.remove('qualiflow-hidden');
                } else {
                    feedback.textContent = 'Atualizado com sucesso!';
                    feedback.className = 'qualiflow-info';
                    feedback.classList.remove('qualiflow-hidden');

                    // Update DOM states immediately
                    selectedIds.forEach(id => {
                        const row = listDiv.querySelector(`.test-item[data-id="${id}"]`);
                        if (row) {
                            const badge = row.querySelector('.test-state-badge');
                            const color = (stateVal.toLowerCase() === 'done' || stateVal.toLowerCase() === 'closed') ? '#10b981' : '#f59e0b';
                            badge.style.backgroundColor = `${color}20`;
                            badge.style.color = color;
                            badge.style.borderColor = `${color}40`;
                            badge.querySelector('.state-val').textContent = stateVal;
                        }

                        // update the in-memory array too
                        const tcRef = testCases.find(t => t.id === id);
                        if (tcRef) tcRef.state = stateVal;
                    });
                }
            });
        });
    }

    const overlay = document.getElementById('qualiflow-tests-modal-overlay');
    overlay.classList.remove('qualiflow-hidden');
}
function renderDashboard(data) {
    currentDashboardData = data || [];
    const container = document.getElementById('qualiflow-dashboard-cards');
    if (!container) return;
    container.innerHTML = '';

    if (currentDashboardData.length === 0) {
        container.innerHTML = '<div class="qualiflow-info">Nenhum card encontrado no board para o dashboard geral.</div>';
        return;
    }

    // Extract iterations
    const iterations = [...new Set(currentDashboardData.map(d => d.iterationPath))].sort();

    const header = document.createElement('div');
    header.className = 'qualiflow-dashboard-header';
    header.style.marginBottom = '20px';
    header.innerHTML = `
                <h3 style="margin-bottom:8px">Cards do Board (Dashboard Geral)</h3>
                    <div class="qualiflow-select-group" style="max-width: 300px;">
                        <label>Filtrar por Sprint/Iteration:</label>
                        <select id="qualiflow-dash-filter" class="qualiflow-select-input">
                            <option value="All">Todas as Iterations</option>
                            ${iterations.map(i => `<option value="${i}">${i}</option>`).join('')}
                        </select>
                    </div>
            `;

    const summaryContainer = document.createElement('div');
    summaryContainer.id = 'qualiflow-dash-summary';
    summaryContainer.style.display = 'flex';
    summaryContainer.style.gap = '8px';
    summaryContainer.style.marginBottom = '20px';
    summaryContainer.style.flexWrap = 'wrap';

    const list = document.createElement('div');
    list.id = 'qualiflow-dash-list';
    list.style.display = 'grid';
    list.style.gridTemplateColumns = 'repeat(auto-fit, minmax(250px, 1fr))';
    list.style.gap = '12px';

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
        list.innerHTML = '<p style="color:#94a3b8">Nenhum card nesta sprint.</p>';
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
            <div style="background-color:${c.style.color}20; color:${c.style.color}; padding:4px 10px; border-radius:6px; font-size:0.8rem; font-weight:600; border: 1px solid ${c.style.color}40; display:flex; align-items:center; gap:4px;">
                <span>${c.style.icon}</span>
                <span>${c.count} ${c.rawType}(s)</span>
            </div>
            `).join('');
    }

    filtered.forEach(wi => {
        const card = document.createElement('div');
        card.className = 'qualiflow-acc-item';
        card.style.padding = '12px';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.justifyContent = 'space-between';

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
            ? `<span title="Aviso: PBI finalizado mas há testes pendentes!" style="cursor:help; padding-left:6px;">⚠️</span>`
            : '';

        let testsInfoHtml = '';
        if (testCases.length > 0) {
            testsInfoHtml = `<div style="margin-top:2px;" title="${testCases.length} Testes Associados"><strong>Testes:</strong> ${testCases.length} vinculado(s)</div>`;
        }

        card.innerHTML = `
            <div>
                <div style="font-weight:600; color:#e2e8f0; margin-bottom:8px; line-height: 1.4;">#${wi.id} - ${wi.title} ${warningIcon}</div>
                <div style="font-size:0.8rem; color:#94a3b8; display:flex; flex-direction:column; gap:6px;">
                    <div style="display:flex; align-items:center; gap:6px;">
                        <span style="background-color:${typeStyle.color}20; color:${typeStyle.color}; padding:2px 6px; border-radius:4px; font-weight:600; font-size:0.75rem; border: 1px solid ${typeStyle.color}40;">
                            ${typeStyle.icon} ${wi.type}
                        </span>
                        <span>${wi.state}</span>
                    </div>
                    <div title="${wi.iterationPath || 'Desconhecido'}" style="margin-top:2px;"><strong>Sprint:</strong> ${getIterationLabel(wi.iterationPath)}</div>
                    ${testsInfoHtml}
                </div>
            </div>
            <div style="margin-top:12px; display:flex; gap:8px;">
                <a href="${wi.url}" class="qualiflow-btn-inline qualiflow-btn-primary" style="text-decoration:none; display:inline-block; font-size:0.75rem; flex:1; text-align:center;">Abrir</a>
                ${testCases.length > 0 ? `<button class="qualiflow-btn-inline qualiflow-btn-secondary btn-tests" style="font-size:0.75rem; flex:1;">Ver Testes</button>` : ''}
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

function parseTagList(rawTags) {
    return String(rawTags || '')
        .split(';')
        .map((tag) => tag.trim())
        .filter(Boolean);
}

function normalizeAnalyticsToken(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function detectStackFromTags(tags) {
    const normalized = tags.map(normalizeAnalyticsToken);
    const hasFront = normalized.some((tag) => tag === 'front' || tag === 'frontend' || tag === 'ui');
    const hasBack = normalized.some((tag) => tag === 'back' || tag === 'backend' || tag === 'api');
    const hasTech = normalized.some((tag) => tag === 'tecnica' || tag === 'tecnico' || tag === 'technical' || tag === 'tecnico-debito');

    if (hasFront && hasBack) return 'Front + Back';
    if (hasFront) return 'Front';
    if (hasBack) return 'Back';
    if (hasTech) return 'Tecnico';
    return 'Nao classificado';
}

const OFFICIAL_TEST_PREFIXES = [
    'UI', 'FUNC', 'UX', 'ACC', 'INT',
    'SCHEMA', 'SEG', 'PERF',
    'VALID', 'REG', 'SMOKE', 'E2E'
];

function getSprintNumber(value) {
    const label = getIterationLabel(value);
    const match = String(label).match(/sprint\s*(\d+)/i);
    return match ? Number(match[1]) : null;
}

function compareIterations(a, b) {
    const na = getSprintNumber(a);
    const nb = getSprintNumber(b);
    if (na !== null && nb !== null) return na - nb;
    return String(a).localeCompare(String(b), 'pt-BR');
}

function initMultiSelectDropdown(rootEl, { placeholder, onChange }) {
    if (!rootEl) return null;

    const trigger = rootEl.querySelector('.qualiflow-multi-select-trigger');
    const labelEl = rootEl.querySelector('.qualiflow-multi-select-label');
    const panelEl = rootEl.querySelector('.qualiflow-multi-select-panel');
    if (!trigger || !labelEl || !panelEl) return null;

    let options = [];
    let selected = new Set();

    const updateLabel = () => {
        if (selected.size === 0) {
            labelEl.textContent = `${placeholder}: Todos`;
            return;
        }
        if (selected.size === 1) {
            labelEl.textContent = `${placeholder}: ${Array.from(selected)[0]}`;
            return;
        }
        labelEl.textContent = `${placeholder}: ${selected.size} selecionados`;
    };

    const renderOptions = () => {
        panelEl.innerHTML = '';
        options.forEach((value) => {
            const optionEl = document.createElement('label');
            optionEl.className = 'qualiflow-multi-select-option';

            const checkboxEl = document.createElement('input');
            checkboxEl.type = 'checkbox';
            checkboxEl.value = value;
            checkboxEl.checked = selected.has(value);

            checkboxEl.addEventListener('change', () => {
                if (checkboxEl.checked) selected.add(value);
                else selected.delete(value);
                updateLabel();
                onChange?.();
            });

            const textEl = document.createElement('span');
            textEl.textContent = value;

            optionEl.appendChild(checkboxEl);
            optionEl.appendChild(textEl);
            panelEl.appendChild(optionEl);
        });
        updateLabel();
    };

    const close = () => rootEl.classList.remove('is-open');
    const toggle = () => {
        const isOpen = rootEl.classList.contains('is-open');
        document.querySelectorAll('.qualiflow-multi-select.is-open').forEach((el) => {
            if (el !== rootEl) el.classList.remove('is-open');
        });
        rootEl.classList.toggle('is-open', !isOpen);
    };

    trigger.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        toggle();
    });

    panelEl.addEventListener('click', (event) => event.stopPropagation());

    const onDocumentClick = (event) => {
        if (!rootEl.contains(event.target)) close();
    };
    document.addEventListener('click', onDocumentClick);

    return {
        setOptions: (nextOptions) => {
            options = [...new Set((nextOptions || []).filter(Boolean))];
            selected = new Set([...selected].filter((v) => options.includes(v)));
            renderOptions();
        },
        getSelectedValues: () => [...selected],
        setSelectedValues: (values) => {
            const next = new Set((values || []).filter((v) => options.includes(v)));
            selected = next;
            renderOptions();
        },
        destroy: () => {
            document.removeEventListener('click', onDocumentClick);
        }
    };
}

function extractTestPrefix(title) {
    const text = String(title || '').trim().toUpperCase();
    const tokenMatch = text.match(/^([A-Z0-9]{2,10})(?:[\s:_\-]|$)/);
    const token = tokenMatch ? tokenMatch[1] : '';

    if (OFFICIAL_TEST_PREFIXES.includes(token)) return token;
    return 'OUTROS';
}

function extractQaLabel(parentTags, testTags, assignedTo) {
    const allTags = [...parentTags, ...testTags];
    for (const tag of allTags) {
        const qaMatch = tag.match(/^qa[\s:_-]*(.+)$/i);
        if (qaMatch && qaMatch[1] && qaMatch[1].trim()) {
            return qaMatch[1].trim();
        }
    }

    const filtered = allTags.filter((tag) => {
        const token = normalizeAnalyticsToken(tag);
        return !['front', 'frontend', 'ui', 'back', 'backend', 'api', 'tecnica', 'tecnico', 'technical'].includes(token);
    });
    if (filtered.length > 0) return filtered[0];

    if (assignedTo) {
        return String(assignedTo).trim().split(/\s+/)[0] || 'Sem QA';
    }
    return 'Sem QA';
}

function mapColorByIndex(index) {
    const palette = ['#06b6d4', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316', '#3b82f6', '#a855f7', '#84cc16'];
    return palette[index % palette.length];
}

function buildAnalyticsBars(items, totalCount) {
    if (!items.length) {
        return '<div style="color:#94a3b8; font-size:0.82rem;">Sem dados para o filtro selecionado.</div>';
    }

    return `
        <div style="display:flex; flex-direction:column; gap:8px;">
            ${items.map((item, index) => {
            const total = totalCount || 1;
            const width = Math.max((item.value / total) * 100, item.value > 0 ? 3 : 0);
            const color = mapColorByIndex(index);
            return `
                    <div>
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; font-size:0.78rem; color:#cbd5e1;">
                            <span>${item.label}</span>
                            <span>${item.value}</span>
                        </div>
                        <div style="background:#0f172a; border:1px solid #334155; border-radius:999px; height:10px; overflow:hidden;">
                            <div style="height:100%; width:${width}%; background:${color};"></div>
                        </div>
                    </div>
                `;
        }).join('')}
        </div>
    `;
}

function toSortedEntries(countMap, maxItems = 8) {
    return [...countMap.entries()]
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, maxItems);
}

let currentAnalyticsData = null;
let currentDashboardData = [];
let currentSupportCardsData = null;
let analyticsDropdownDisposers = [];
let supportDropdownDisposers = [];
let deployDropdownDisposers = [];

function renderAnalyticsDashboard(payload) {
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
        container.innerHTML = '<div class="qualiflow-info">Nenhum Test Case disponível para análise.</div>';
        return;
    }

    const iterations = [...new Set(items.map((tc) => tc.iterationPath || tc.parentIterationPath).filter(Boolean))]
        .sort(compareIterations);

    const debugMeta = payload?.meta || window.qualiflowDashboardMeta || null;

    container.innerHTML = `
        <div class="qualiflow-analytics-view" style="padding:2px 2px 6px 2px;">
            <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-end; flex-wrap:wrap; margin-bottom:14px;">
                <div>
                    <h3 style="margin:0; color:#f8fafc;">Analytics Pro de Testes e Cobertura</h3>
                    <div style="margin-top:4px; color:#94a3b8; font-size:0.82rem;">Visão executiva por prefixo, stack, card pai e QA.</div>
                    ${debugMeta ? `<div style="margin-top:4px; color:#7dd3fc; font-size:0.75rem;">Fonte principal: pais=${debugMeta.parentCardsLoaded ?? '-'} | testes vinculados=${debugMeta.linkedTestsLoaded ?? '-'} | standalone=${debugMeta.standaloneTestsLoaded ?? '-'} | total=${debugMeta.totalItemsReturned ?? '-'}</div>` : ''}
                </div>
                <div class="qualiflow-analytics-filters">
                    <select id="qualiflow-analytics-filter-iteration" class="qualiflow-select-input">
                        <option value="All">Todas as Iterations</option>
                        ${iterations.map((i) => `<option value="${i}">${getIterationLabel(i)}</option>`).join('')}
                    </select>
                    <select id="qualiflow-analytics-filter-stack" class="qualiflow-select-input">
                        <option value="all">Todos os stacks</option>
                        <option value="Front">Front</option>
                        <option value="Back">Back</option>
                        <option value="Tecnico">Tecnico</option>
                        <option value="Front + Back">Front + Back</option>
                        <option value="Nao classificado">Nao classificado</option>
                    </select>
                    <div id="qualiflow-analytics-filter-type" class="qualiflow-multi-select">
                        <button type="button" class="qualiflow-select-input qualiflow-multi-select-trigger" title="Selecione os Tipos de card">
                            <span class="qualiflow-multi-select-label">Tipo: Todos</span>
                            <span class="qualiflow-multi-select-arrow">▼</span>
                        </button>
                        <div class="qualiflow-multi-select-panel"></div>
                    </div>
                    <div id="qualiflow-analytics-filter-prefix" class="qualiflow-multi-select">
                        <button type="button" class="qualiflow-select-input qualiflow-multi-select-trigger" title="Selecione os Prefixos de teste">
                            <span class="qualiflow-multi-select-label">Prefixo: Todos</span>
                            <span class="qualiflow-multi-select-arrow">▼</span>
                        </button>
                        <div class="qualiflow-multi-select-panel"></div>
                    </div>
                    <div id="qualiflow-analytics-filter-qa" class="qualiflow-multi-select">
                        <button type="button" class="qualiflow-select-input qualiflow-multi-select-trigger" title="Selecione os QAs">
                            <span class="qualiflow-multi-select-label">QA: Todos</span>
                            <span class="qualiflow-multi-select-arrow">▼</span>
                        </button>
                        <div class="qualiflow-multi-select-panel"></div>
                    </div>
                    <select id="qualiflow-analytics-trend-start" class="qualiflow-select-input">
                        <option value="all">Tendência: início (auto)</option>
                        ${iterations.map((i) => `<option value="${i}">${getIterationLabel(i)}</option>`).join('')}
                    </select>
                    <select id="qualiflow-analytics-trend-end" class="qualiflow-select-input">
                        <option value="all">Tendência: fim (auto)</option>
                        ${iterations.map((i) => `<option value="${i}">${getIterationLabel(i)}</option>`).join('')}
                    </select>
                    <div id="qualiflow-analytics-heatmap-qa" class="qualiflow-multi-select">
                        <button type="button" class="qualiflow-select-input qualiflow-multi-select-trigger" title="Selecione os QAs para o Heatmap">
                            <span class="qualiflow-multi-select-label">Heatmap QA: Todos</span>
                            <span class="qualiflow-multi-select-arrow">▼</span>
                        </button>
                        <div class="qualiflow-multi-select-panel"></div>
                    </div>
                    <div id="qualiflow-analytics-heatmap-prefix" class="qualiflow-multi-select">
                        <button type="button" class="qualiflow-select-input qualiflow-multi-select-trigger" title="Selecione os Prefixos para o Heatmap">
                            <span class="qualiflow-multi-select-label">Heatmap Prefixo: Todos</span>
                            <span class="qualiflow-multi-select-arrow">▼</span>
                        </button>
                        <div class="qualiflow-multi-select-panel"></div>
                    </div>
                </div>
            </div>

            <div id="qualiflow-analytics-kpis" class="qualiflow-analytics-kpis"></div>

            <div class="qualiflow-analytics-grid">
                <div class="qualiflow-analytics-card" style="border:1px solid #334155; border-radius:10px; padding:12px;">
                    <div style="font-weight:700; color:#e2e8f0; margin-bottom:8px;">Mix por prefixo (Donut)</div>
                    <div id="qualiflow-analytics-prefix-donut" class="qualiflow-analytics-plot"></div>
                </div>
                <div class="qualiflow-analytics-card" style="border:1px solid #334155; border-radius:10px; padding:12px;">
                    <div style="font-weight:700; color:#e2e8f0; margin-bottom:8px;">Distribuição por stack (Donut)</div>
                    <div id="qualiflow-analytics-stack-donut" class="qualiflow-analytics-plot"></div>
                </div>
                <div class="qualiflow-analytics-card qualiflow-analytics-card-wide" style="border:1px solid #334155; border-radius:10px; padding:12px;">
                    <div style="font-weight:700; color:#e2e8f0; margin-bottom:8px;">Tendência de Test Cases por iteration</div>
                    <div id="qualiflow-analytics-trend-line" class="qualiflow-analytics-plot"></div>
                </div>
                <div class="qualiflow-analytics-card" style="border:1px solid #334155; border-radius:10px; padding:12px;">
                    <div style="font-weight:700; color:#e2e8f0; margin-bottom:8px;">Balanceamento de qualidade (Radar)</div>
                    <div id="qualiflow-analytics-quality-radar" class="qualiflow-analytics-plot"></div>
                </div>
                <div class="qualiflow-analytics-card" style="border:1px solid #334155; border-radius:10px; padding:12px;">
                    <div style="font-weight:700; color:#e2e8f0; margin-bottom:8px;">Execução concluída (Gauge)</div>
                    <div id="qualiflow-analytics-execution-gauge" class="qualiflow-analytics-plot"></div>
                </div>
                <div class="qualiflow-analytics-card qualiflow-analytics-card-wide" style="border:1px solid #334155; border-radius:10px; padding:12px;">
                    <div style="font-weight:700; color:#e2e8f0; margin-bottom:8px;">Heatmap QA x Prefixo</div>
                    <div id="qualiflow-analytics-qa-prefix-heatmap" class="qualiflow-analytics-plot"></div>
                </div>
            </div>

            <div class="qualiflow-analytics-grid qualiflow-analytics-grid-secondary">
                <div class="qualiflow-analytics-card" style="border:1px solid #334155; border-radius:10px; padding:12px;">
                    <div style="font-weight:700; color:#e2e8f0; margin-bottom:8px;">Testes por card pai (Top tipos)</div>
                    <div id="qualiflow-analytics-parent-type-chart" class="qualiflow-analytics-plot"></div>
                </div>
                <div class="qualiflow-analytics-card" style="border:1px solid #334155; border-radius:10px; padding:12px;">
                    <div style="font-weight:700; color:#e2e8f0; margin-bottom:8px;">Testes por QA (Top)</div>
                    <div id="qualiflow-analytics-qa-chart" class="qualiflow-analytics-plot"></div>
                </div>
            </div>

            <div id="qualiflow-analytics-table" style="margin-top:14px;"></div>
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
                <div style="background:#0f172a; border:1px solid #334155; border-radius:10px; padding:10px;">
                    <div style="font-size:0.74rem; color:#94a3b8;">Test Cases analisados</div>
                    <div style="font-size:1.35rem; color:#f8fafc; font-weight:700;">${totalTests}</div>
                </div>
                <div style="background:#0f172a; border:1px solid #334155; border-radius:10px; padding:10px;">
                    <div style="font-size:0.74rem; color:#94a3b8;">Cards pai mapeados</div>
                    <div style="font-size:1.35rem; color:#f8fafc; font-weight:700;">${cardsWithTests}</div>
                </div>
                <div style="background:#0f172a; border:1px solid #334155; border-radius:10px; padding:10px;">
                    <div style="font-size:0.74rem; color:#94a3b8;">Cobertura por card</div>
                    <div style="font-size:1.35rem; color:#10b981; font-weight:700;">${cardCoverage}%</div>
                </div>
                <div style="background:#0f172a; border:1px solid #334155; border-radius:10px; padding:10px;">
                    <div style="font-size:0.74rem; color:#94a3b8;">Prefixos identificados</div>
                    <div style="font-size:1.35rem; color:#f8fafc; font-weight:700;">${new Set(filteredRows.map((row) => row.testPrefix)).size}</div>
                </div>
                <div style="background:#0f172a; border:1px solid #334155; border-radius:10px; padding:10px;">
                    <div style="font-size:0.74rem; color:#94a3b8;">Execução concluída</div>
                    <div style="font-size:1.35rem; color:#06b6d4; font-weight:700;">${executionCoverage}%</div>
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

        if (globalThis.QaCharts) {
            globalThis.QaCharts.donut(prefixDonut, prefixTop, { caption: 'test cases' });
            globalThis.QaCharts.donut(stackDonut, stackTop, { caption: 'stack' });
            globalThis.QaCharts.gauge(executionGauge, executionCoverage, 'done/closed');

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

            globalThis.QaCharts.line(trendLine, trendPoints, { color: '#60a5fa' });

            const radarData = prefixTop.slice(0, 6);
            globalThis.QaCharts.radar(qualityRadar, radarData);

            const selectedHeatmapQa = heatmapQaMulti?.getSelectedValues?.() || [];
            const selectedHeatmapPrefix = heatmapPrefixMulti?.getSelectedValues?.() || [];

            const qaRows = (selectedHeatmapQa.length > 0 ? selectedHeatmapQa : allQa).slice(0, 20);
            const prefixCols = (selectedHeatmapPrefix.length > 0 ? selectedHeatmapPrefix : allPrefixes).slice(0, 20);
            const matrix = qaRows.map((qa) => {
                return prefixCols.map((prefix) => {
                    return filteredRows.filter((r) => r.qa === qa && r.testPrefix === prefix).length;
                });
            });
            globalThis.QaCharts.heatmap(qaPrefixHeatmap, qaRows, prefixCols, matrix);
        } else {
            if (prefixDonut) prefixDonut.innerHTML = buildAnalyticsBars(prefixTop, totalTests);
            if (stackDonut) stackDonut.innerHTML = buildAnalyticsBars(stackTop, totalTests);
            if (trendLine) trendLine.innerHTML = '<div style="color:#94a3b8; font-size:0.82rem;">Biblioteca visual indisponível.</div>';
            if (qualityRadar) qualityRadar.innerHTML = '<div style="color:#94a3b8; font-size:0.82rem;">Biblioteca visual indisponível.</div>';
            if (executionGauge) executionGauge.innerHTML = `<div style="color:#cbd5e1; font-weight:700;">${executionCoverage}% concluído</div>`;
            if (qaPrefixHeatmap) qaPrefixHeatmap.innerHTML = '<div style="color:#94a3b8; font-size:0.82rem;">Biblioteca visual indisponível.</div>';
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
                <div style="background:#0f172a; border:1px solid #334155; border-radius:10px; overflow:hidden;">
                    <div style="padding:10px 12px; border-bottom:1px solid #334155; color:#e2e8f0; font-weight:700;">Top cards por volume de testes</div>
                    <div style="overflow:auto; max-height:320px;">
                        <table style="width:100%; border-collapse:collapse; font-size:0.78rem;">
                            <thead>
                                <tr style="background:#111827; color:#cbd5e1; text-align:left;">
                                    <th style="padding:8px 10px; border-bottom:1px solid #334155;">Card</th>
                                    <th style="padding:8px 10px; border-bottom:1px solid #334155;">Tipo pai</th>
                                    <th style="padding:8px 10px; border-bottom:1px solid #334155;">Qtd Testes</th>
                                    <th style="padding:8px 10px; border-bottom:1px solid #334155;">Done</th>
                                    <th style="padding:8px 10px; border-bottom:1px solid #334155;">Cobertura execução</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${ranking.map((row) => {
                const percent = row.tests === 0 ? 0 : Math.round((row.done / row.tests) * 100);
                return `
                                        <tr>
                                            <td style="padding:8px 10px; border-bottom:1px solid #1f2937; color:#e2e8f0;">#${row.parentId} - ${row.parentTitle}</td>
                                            <td style="padding:8px 10px; border-bottom:1px solid #1f2937; color:#cbd5e1;">${row.parentType}</td>
                                            <td style="padding:8px 10px; border-bottom:1px solid #1f2937; color:#e2e8f0; font-weight:700;">${row.tests}</td>
                                            <td style="padding:8px 10px; border-bottom:1px solid #1f2937; color:#10b981; font-weight:700;">${row.done}</td>
                                            <td style="padding:8px 10px; border-bottom:1px solid #1f2937; color:#06b6d4; font-weight:700;">${percent}%</td>
                                        </tr>
                                    `;
            }).join('')}
                            </tbody>
                        </table>
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

function loadAnalyticsDashboardData() {
    const container = document.getElementById('qualiflow-dashboard-analytics');
    if (!container) return;
    container.innerHTML = '<div class="qualiflow-info">Carregando Test Cases de todas as sprints/iterations...</div>';

    sendRuntimeMessage({ action: 'GET_TEST_CASE_ANALYTICS' }, (response) => {
        if (response?.error) {
            container.innerHTML = `<div class="qualiflow-error">Erro ao carregar analytics de Test Case: ${response.error}</div>`;
            return;
        }

        currentAnalyticsData = response?.data || { items: [] };
        renderAnalyticsDashboard(currentAnalyticsData);
    });
}

function renderDeployValidation() {
    const container = document.getElementById('qualiflow-dashboard-deploy');
    if (!container) return;
    container.innerHTML = '';

    const section = document.createElement('div');
    section.innerHTML = `
        <h3 style="margin-bottom:16px">Validar Deploy</h3>
        <div class="qualiflow-select-group" style="margin-bottom:16px;">
            <label>Sprint / Iteration:</label>
            <select id="qualiflow-deploy-sprint-select" class="qualiflow-select-input" style="width:100%;">
                <option value="">Carregando sprints...</option>
            </select>
        </div>
        <button id="qualiflow-deploy-validate-btn" class="qualiflow-btn qualiflow-btn-primary" style="width:100%; padding:10px; margin-bottom:16px;">Validar</button>
        <div id="qualiflow-deploy-results" style="display:none;"></div>
        <div id="qualiflow-deploy-loading" style="display:none; color:#94a3b8; text-align:center;">Carregando...</div>
    `;
    container.appendChild(section);

    loadDeployIterations();
}

function renderSupportCards(data) {
    supportDropdownDisposers.forEach((dispose) => {
        try {
            dispose();
        } catch (_err) {
            // noop
        }
    });
    supportDropdownDisposers = [];

    currentSupportCardsData = data || [];
    const container = document.getElementById('qualiflow-dashboard-support');
    if (!container) return;

    container.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'qualiflow-dashboard-header';
    header.style.marginBottom = '16px';
    header.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; margin-bottom:8px;">
            <h3 style="margin:0;">Suportes (Tipo Sustentação)</h3>
            <button id="qualiflow-support-test-notification" class="qualiflow-btn-inline qualiflow-btn-secondary" style="font-size:0.75rem;">Testar Notificação Agora</button>
        </div>
        <div id="qualiflow-support-test-feedback" style="font-size:0.8rem; color:#94a3b8;"></div>
    `;
    container.appendChild(header);

    const testBtn = document.getElementById('qualiflow-support-test-notification');
    const testFeedback = document.getElementById('qualiflow-support-test-feedback');
    if (testBtn && testFeedback) {
        testBtn.addEventListener('click', () => {
            testBtn.disabled = true;
            testBtn.textContent = 'Executando...';
            testFeedback.style.color = '#94a3b8';
            testFeedback.textContent = 'Disparando monitor manual...';

            sendRuntimeMessage({ action: 'RUN_SUPPORT_MONITOR_NOW' }, (response) => {
                testBtn.disabled = false;
                testBtn.textContent = 'Testar Notificação Agora';

                if (response?.error || response?.ok === false) {
                    testFeedback.style.color = '#ef4444';
                    testFeedback.textContent = `Erro: ${response?.error || 'falha ao executar monitor'}`;
                    return;
                }

                const result = response?.result || {};
                if (result.skipped) {
                    testFeedback.style.color = '#f59e0b';
                    if (result.reason === 'missing-webhook-config') {
                        testFeedback.textContent = 'Webhook não configurado. Vá em Opções > Geral e informe a URL do webhook.';
                    } else if (result.reason === 'missing-azure-config') {
                        testFeedback.textContent = 'Configuração do Azure incompleta para monitoramento.';
                    } else {
                        testFeedback.textContent = `Monitor não executado (${result.reason}).`;
                    }
                    return;
                }

                if (result.error) {
                    testFeedback.style.color = '#ef4444';
                    testFeedback.textContent = `Erro no monitor: ${result.error}`;
                    return;
                }

                testFeedback.style.color = '#10b981';
                const deliveries = Array.isArray(result.deliveries) ? result.deliveries : [];
                const destination = result?.destination;
                const deliveryHints = deliveries
                    .slice(0, 3)
                    .map((d) => {
                        const run = d?.runId ? `runId ${d.runId}` : 'runId n/a';
                        const tracking = d?.trackingId ? `tracking ${d.trackingId}` : 'tracking n/a';
                        return `#${d.supportId}: ${run}, ${tracking}`;
                    })
                    .join(' | ');

                const destinationHint = destination?.host
                    ? ` Destino: ${destination.host}${destination.pathname || ''}.`
                    : '';

                const suffix = deliveryHints ? ` Detalhes: ${deliveryHints}.` : '';
                testFeedback.textContent = `Monitor executado. Transições: ${result.transitions || 0}, notificações enviadas: ${result.sentCount || 0}, falhas: ${result.failedCount || 0}.${destinationHint}${suffix}`;
            });
        });
    }

    if (currentSupportCardsData.length === 0) {
        container.innerHTML += '<div class="qualiflow-info">Nenhum card de Sustentação encontrado no board.</div>';
        return;
    }

    const getAssigneeLabel = (assignedTo) => {
        if (!assignedTo) return 'Não atribuído';
        if (typeof assignedTo === 'string') return assignedTo.trim() || 'Não atribuído';
        return (
            assignedTo.displayName ||
            assignedTo.uniqueName ||
            assignedTo.name ||
            'Não atribuído'
        );
    };

    const parseTags = (tags) => {
        return String(tags || '')
            .split(';')
            .map((t) => t.trim())
            .filter(Boolean);
    };

    const states = [...new Set(currentSupportCardsData
        .map((wi) => String(wi.state || '').trim())
        .filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));

    const tags = [...new Set(currentSupportCardsData
        .flatMap((wi) => parseTags(wi.tags)))].sort((a, b) => a.localeCompare(b, 'pt-BR'));

    const owners = [...new Set(currentSupportCardsData
        .map((wi) => getAssigneeLabel(wi.assignedTo))
        .filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));

    const filters = document.createElement('div');
    filters.style.display = 'grid';
    filters.style.gridTemplateColumns = 'repeat(auto-fit, minmax(180px, 1fr))';
    filters.style.gap = '10px';
    filters.style.marginBottom = '14px';
    filters.innerHTML = `
        <div class="qualiflow-select-group">
            <label for="qualiflow-support-filter-state">Estado</label>
            <select id="qualiflow-support-filter-state" class="qualiflow-select-input">
                <option value="">Todos os estados</option>
                ${states.map((s) => `<option value="${s}">${s}</option>`).join('')}
            </select>
        </div>
        <div class="qualiflow-select-group">
            <label for="qualiflow-support-filter-tag">Tag</label>
            <div id="qualiflow-support-filter-tag" class="qualiflow-multi-select">
                <button type="button" class="qualiflow-select-input qualiflow-multi-select-trigger" title="Selecione as tags">
                    <span class="qualiflow-multi-select-label">Tag: Todas</span>
                    <span class="qualiflow-multi-select-arrow">▼</span>
                </button>
                <div class="qualiflow-multi-select-panel"></div>
            </div>
        </div>
        <div class="qualiflow-select-group">
            <label for="qualiflow-support-filter-owner">Responsável</label>
            <select id="qualiflow-support-filter-owner" class="qualiflow-select-input">
                <option value="">Todos os responsáveis</option>
                ${owners.map((o) => `<option value="${o}">${o}</option>`).join('')}
            </select>
        </div>
    `;
    container.appendChild(filters);

    const info = document.createElement('div');
    info.id = 'qualiflow-support-filter-info';
    info.style.marginBottom = '10px';
    info.style.fontSize = '0.82rem';
    info.style.color = '#94a3b8';
    container.appendChild(info);

    const list = document.createElement('div');
    list.id = 'qualiflow-support-cards-list';
    list.style.display = 'grid';
    list.style.gridTemplateColumns = 'repeat(auto-fit, minmax(250px, 1fr))';
    list.style.gap = '12px';
    container.appendChild(list);

    const stateSelect = document.getElementById('qualiflow-support-filter-state');
    const tagSelect = document.getElementById('qualiflow-support-filter-tag');
    const ownerSelect = document.getElementById('qualiflow-support-filter-owner');
    const tagMulti = initMultiSelectDropdown(tagSelect, {
        placeholder: 'Tag',
        onChange: () => drawSupportCards()
    });
    if (tagMulti?.destroy) supportDropdownDisposers.push(tagMulti.destroy);
    if (tagMulti) tagMulti.setOptions(tags);

    const norm = (v) => String(v || '').trim().toLowerCase();

    const drawSupportCards = () => {
        const selectedState = stateSelect?.value || '';
        const selectedTags = tagMulti?.getSelectedValues?.() || [];
        const selectedOwner = ownerSelect?.value || '';

        const filtered = currentSupportCardsData.filter((wi) => {
            const assignee = getAssigneeLabel(wi.assignedTo);
            const wiTags = parseTags(wi.tags);

            if (selectedState && norm(wi.state) !== norm(selectedState)) return false;
            if (selectedTags.length > 0) {
                const selectedNormalized = selectedTags.map(norm);
                if (!wiTags.some((t) => selectedNormalized.includes(norm(t)))) return false;
            }
            if (selectedOwner && norm(assignee) !== norm(selectedOwner)) return false;
            return true;
        });

        info.textContent = `${filtered.length} item(ns) exibido(s) de ${currentSupportCardsData.length}.`;
        list.innerHTML = '';

        if (filtered.length === 0) {
            list.innerHTML = '<p style="color:#94a3b8">Nenhum card encontrado com os filtros selecionados.</p>';
            return;
        }

        filtered.forEach((wi) => {
            const card = document.createElement('div');
            card.className = 'qualiflow-acc-item';
            card.style.padding = '12px';
            card.style.display = 'flex';
            card.style.flexDirection = 'column';
            card.style.justifyContent = 'space-between';

            const typeStyle = getDashboardTypeStyle(wi.type);
            const assignee = getAssigneeLabel(wi.assignedTo);
            const wiTags = parseTags(wi.tags);
            const tagText = wiTags.length > 0 ? wiTags.join(', ') : 'Sem tag';

            card.innerHTML = `
                <div>
                    <div style="font-weight:600; color:#e2e8f0; margin-bottom:8px; line-height:1.4;">#${wi.id} - ${wi.title}</div>
                    <div style="font-size:0.8rem; color:#94a3b8; display:flex; flex-direction:column; gap:6px;">
                        <div style="display:flex; align-items:center; gap:6px;">
                            <span style="background-color:${typeStyle.color}20; color:${typeStyle.color}; padding:2px 6px; border-radius:4px; font-weight:600; font-size:0.75rem; border:1px solid ${typeStyle.color}40;">
                                ${typeStyle.icon} ${wi.type}
                            </span>
                            <span>${wi.state}</span>
                        </div>
                        <div><strong>Responsável:</strong> ${assignee}</div>
                        <div title="${tagText}"><strong>Tags:</strong> ${tagText}</div>
                        <div title="${wi.iterationPath || 'Desconhecido'}" style="margin-top:2px;"><strong>Sprint:</strong> ${getIterationLabel(wi.iterationPath)}</div>
                    </div>
                </div>
                <div style="margin-top:12px; display:flex; gap:8px;">
                    <a href="${wi.url}" class="qualiflow-btn-inline qualiflow-btn-primary" style="text-decoration:none; display:inline-block; font-size:0.75rem; flex:1; text-align:center;">Abrir</a>
                </div>
            `;

            list.appendChild(card);
        });
    };

    stateSelect?.addEventListener('change', drawSupportCards);
    ownerSelect?.addEventListener('change', drawSupportCards);

    drawSupportCards();
}

function loadSupportCards() {
    const container = document.getElementById('qualiflow-dashboard-support');
    if (!container) return;
    container.innerHTML = '<div class="qualiflow-info">Carregando cards de sustentação...</div>';

    sendRuntimeMessage({ action: 'GET_SUPPORT_CARDS' }, (response) => {
        if (response && response.error) {
            container.innerHTML = `<div class="qualiflow-error">Erro: ${response.error}</div>`;
            return;
        }
        renderSupportCards(response?.data || []);
    });
}

function loadDeployIterations() {
    const select = document.getElementById('qualiflow-deploy-sprint-select');
    if (!select) return;
    
    select.innerHTML = '<option value="">Carregando...</option>';
    select.disabled = true;

    sendRuntimeMessage({ action: "GET_PROJECT_ITERATIONS" }, (response) => {
        if (response && response.error) {
            select.innerHTML = `<option value="">Erro: ${response.error}</option>`;
            select.disabled = true;
            return;
        }

        const sprints = (response.data || []).map(s => s.path || s);
        if (sprints.length === 0) {
            select.innerHTML = '<option value="">Nenhuma sprint encontrada</option>';
            select.disabled = true;
            return;
        }
        
        select.innerHTML = sprints.map(s => `<option value="${s}">${s.split('\\').pop()}</option>`).join('');
        select.disabled = false;
    });
}

function validateDeployCards() {
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
        action: "GET_DEPLOY_VALIDATION",
        iterationPath: iterationPath
    }, (response) => {
        validateBtn.disabled = false;
        validateBtn.textContent = 'Validar';
        loadingDiv.style.display = 'none';

        if (response && response.error) {
            resultsDiv.innerHTML = `<div class="qualiflow-error" style="padding:12px; border-radius:6px;">Erro: ${response.error}</div>`;
            resultsDiv.style.display = 'block';
            return;
        }

        const payload = response?.data || {};
        const cards = Array.isArray(payload) ? payload : (payload.items || []);
        renderDeployResults(cards, resultsDiv, payload);
        resultsDiv.style.display = 'block';
    });
}

function flattenDeployNodes(nodes, depth = 0, acc = []) {
    (nodes || []).forEach(node => {
        acc.push({ node, depth });
        if (node.children && node.children.length > 0) {
            flattenDeployNodes(node.children, depth + 1, acc);
        }
    });
    return acc;
}

function normalizeDeployText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function getDeployVisibleNodes(cards) {
    return flattenDeployNodes(cards).filter(({ node }) => node.liberado !== 'excluded');
}

function matchesDeployFilters(node, filters) {
    const haystack = normalizeDeployText([
        node.id,
        node.title,
        node.type,
        node.state,
        node.effectiveState,
        node.area,
        (node.stackTags || []).join(' '),
        (node.qaResponsibles || []).join(' '),
        (node.tags || []).join(' '),
        (node.issues || []).join(' ')
    ].join(' '));

    if (filters.search && !haystack.includes(normalizeDeployText(filters.search))) return false;
    const selectedTypes = (filters.types || []).map(normalizeDeployText).filter(Boolean);
    if (selectedTypes.length > 0 && !selectedTypes.includes(normalizeDeployText(node.type || 'Sem tipo'))) return false;
    if (filters.state !== 'all' && normalizeDeployText(node.effectiveState || node.state) !== filters.state) return false;
    const selectedQa = (filters.qaList || []).map(normalizeDeployText).filter(Boolean);
    if (selectedQa.length > 0 && !(node.qaResponsibles || []).some(qa => selectedQa.includes(normalizeDeployText(qa)))) return false;
    if (filters.release !== 'all' && normalizeDeployText(node.liberado) !== filters.release) return false;

    const stack = (node.stackTags || []).map(normalizeDeployText).sort().join('+');
    if (filters.stack === 'front' && !stack.includes('front')) return false;
    if (filters.stack === 'back' && !stack.includes('back')) return false;
    if (filters.stack === 'tecnica' && !stack.includes('tecnica')) return false;
    if (filters.stack === 'front+back' && stack !== 'back+front' && stack !== 'front+back') return false;
    if (filters.stack === 'none' && (node.stackTags || []).length > 0) return false;

    return true;
}

function buildDeployChartRows(title, items) {
    const total = items.reduce((sum, item) => sum + item.count, 0) || 1;
    return `
        <div style="margin-bottom:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <div style="font-weight:600; color:#e2e8f0;">${title}</div>
                <div style="color:#94a3b8; font-size:0.8rem;">${items.reduce((sum, item) => sum + item.count, 0)} itens</div>
            </div>
            <div style="display:flex; flex-direction:column; gap:8px;">
                ${items.map(item => `
                    <div>
                        <div style="display:flex; justify-content:space-between; margin-bottom:4px; color:#cbd5e1; font-size:0.8rem;">
                            <span>${item.label}</span>
                            <span>${item.count}</span>
                        </div>
                        <div style="background:#1e293b; border-radius:999px; overflow:hidden; height:10px;">
                            <div style="width:${Math.max((item.count / total) * 100, item.count > 0 ? 4 : 0)}%; background:${item.color}; height:100%;"></div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function buildDeployCharts(nodes) {
    const nodeList = nodes.map(item => item.node || item);

    const byRelease = [
        { label: 'Liberado', count: nodeList.filter(n => n.liberado === 'yes').length, color: '#10b981' },
        { label: 'Pendente', count: nodeList.filter(n => n.liberado === 'pending').length, color: '#f59e0b' },
        { label: 'Com problema', count: nodeList.filter(n => n.liberado === 'no').length, color: '#ef4444' }
    ];

    const byTypeMap = new Map();
    nodeList.forEach(node => {
        const key = node.type || 'Sem tipo';
        byTypeMap.set(key, (byTypeMap.get(key) || 0) + 1);
    });
    const byType = [...byTypeMap.entries()]
        .map(([label, count]) => ({ label, count, color: getDashboardTypeStyle(label).color }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);

    const byQaMap = new Map();
    nodeList.forEach(node => {
        (node.qaResponsibles || []).forEach(qa => {
            byQaMap.set(qa, (byQaMap.get(qa) || 0) + 1);
        });
    });
    const byQa = [...byQaMap.entries()]
        .map(([label, count]) => ({ label, count, color: '#60a5fa' }))
        .sort((a, b) => b.count - a.count);

    return `
        <div class="qualiflow-dashboard-chart-grid">
            <div class="qualiflow-dashboard-chart-card">
                ${buildDeployChartRows('Liberação', byRelease)}
            </div>
            <div class="qualiflow-dashboard-chart-card">
                ${buildDeployChartRows('Tipos', byType)}
            </div>
            <div class="qualiflow-dashboard-chart-card">
                ${buildDeployChartRows('QA responsáveis', byQa)}
            </div>
        </div>
    `;
}

function matchesDeployExportFilters(node, options = {}) {
    if (!node) return false;

    if (options.release && options.release !== 'all' && normalizeDeployText(node.liberado) !== options.release) {
        return false;
    }

    const selectedResponsibles = (options.responsibles || []).map(normalizeDeployText).filter(Boolean);
    if (selectedResponsibles.length > 0) {
        const nodeResponsibles = (node.qaResponsibles || []).map(normalizeDeployText);
        if (!nodeResponsibles.some(qa => selectedResponsibles.includes(qa))) return false;
    }

    const selectedTypes = (options.types || []).map(normalizeDeployText).filter(Boolean);
    if (selectedTypes.length > 0) {
        if (!selectedTypes.includes(normalizeDeployText(node.type || 'Sem tipo'))) return false;
    }

    return true;
}

function getDeployExportColumns() {
    const defaults = ['id', 'title', 'type', 'qa', 'release'];
    const all = ['id', 'title', 'type', 'state', 'stack', 'qa', 'tags', 'release', 'issues', 'area'];
    return all.filter(key => {
        const el = document.getElementById(`qualiflow-export-col-${key}`);
        if (!el) return defaults.includes(key);
        return !!el.checked;
    });
}

function formatExportCell(value, maxLen = 54) {
    const text = String(value ?? '').replace(/\s+/g, ' ').trim();
    if (text.length <= maxLen) return text;
    return `${text.slice(0, Math.max(maxLen - 1, 1))}…`;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function buildExportRowData(rows) {
    return rows.map(({ node }) => ({
        id: `#${node.id}`,
        title: node.title || '',
        type: node.type || '',
        state: node.effectiveState || node.state || '',
        stack: (node.stackTags || []).join(' + '),
        qa: (node.qaResponsibles || []).join(', '),
        tags: node.hasDeployTag ? 'Liberado deploy' : '',
        release: node.liberado === 'yes' ? 'Liberado' : node.liberado === 'pending' ? 'Pendente' : 'Com problema',
        issues: (node.issues || []).join('; '),
        area: node.area || ''
    }));
}

function buildTeamsTable(rows, columns) {
    const headers = {
        id: 'ID',
        title: 'Card',
        type: 'Tipo',
        state: 'Estado',
        stack: 'Stack',
        qa: 'QA',
        tags: 'Tags',
        release: 'Liberação',
        issues: 'Problemas',
        area: 'Área'
    };

    const formattedRows = buildExportRowData(rows);
    const maxLengths = {};
    columns.forEach(col => {
        maxLengths[col] = headers[col].length;
    });

    formattedRows.forEach(row => {
        columns.forEach(col => {
            const len = String(row[col] || '').length;
            if (len > maxLengths[col]) maxLengths[col] = len;
        });
    });

    const pad = (value, len) => String(value ?? '').padEnd(len, ' ');
    const headerLine = `| ${columns.map(col => pad(headers[col], maxLengths[col])).join(' | ')} |`;
    const separatorLine = `| ${columns.map(col => '-'.repeat(Math.max(maxLengths[col], headers[col].length))).join(' | ')} |`;
    const dataLines = formattedRows.map(row => `| ${columns.map(col => pad(formatExportCell(row[col], Math.max(maxLengths[col], 18)), maxLengths[col])).join(' | ')} |`);
    return [headerLine, separatorLine, ...dataLines].join('\n');
}

function buildExportPlainText(rows, options) {
    const groupBy = options.groupBy || 'none';
    const columns = options.columns || ['id', 'title', 'type', 'qa', 'release'];
    const visibleRows = rows.filter(({ node }) => matchesDeployExportFilters(node, options));

    const sprintName = (options.iterationPath || '').split('\\').pop() || options.iterationPath || 'Sprint';
    const releaseLabel = options.release === 'yes' ? 'Liberados' : options.release === 'pending' ? 'Pendentes' : options.release === 'no' ? 'Com problema' : 'Todos';
    const filtersLabel = [
        options.release !== 'all' ? `Liberação: ${releaseLabel}` : null,
        options.responsibles && options.responsibles.length > 0 ? `Responsáveis: ${options.responsibles.join(', ')}` : null,
        options.types && options.types.length > 0 ? `Tipos: ${options.types.join(', ')}` : null
    ].filter(Boolean).join(' | ');
    const columnsLabel = columns.map(col => ({
        id: 'ID',
        title: 'Card',
        type: 'Tipo',
        state: 'Estado',
        stack: 'Stack',
        qa: 'QA',
        tags: 'Tags',
        release: 'Liberação',
        issues: 'Problemas',
        area: 'Área'
    }[col])).join(', ');

    const lines = [];
    lines.push(`Deploy ${sprintName}`);
    if (options.iterationPath) lines.push(`Sprint: ${options.iterationPath}`);
    lines.push(`Gerado em: ${new Date().toLocaleString('pt-BR')}`);
    lines.push(`Itens exportados: ${visibleRows.length}`);
    if (filtersLabel) lines.push(`Filtros: ${filtersLabel}`);
    lines.push(`Colunas: ${columnsLabel}`);
    lines.push('');

    if (groupBy === 'responsible') {
        const map = new Map();
        visibleRows.forEach(row => {
            const names = row.node.qaResponsibles && row.node.qaResponsibles.length > 0 ? row.node.qaResponsibles : ['Sem responsável'];
            names.forEach(name => {
                if (!map.has(name)) map.set(name, []);
                map.get(name).push(row);
            });
        });
        [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR')).forEach(([groupName, groupRows]) => {
            lines.push(`[${groupName}]`);
            lines.push(buildTeamsTable(groupRows, columns));
            lines.push('');
        });
    } else if (groupBy === 'type') {
        const map = new Map();
        visibleRows.forEach(row => {
            const key = row.node.type || 'Sem tipo';
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(row);
        });
        [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR')).forEach(([groupName, groupRows]) => {
            lines.push(`[${groupName}]`);
            lines.push(buildTeamsTable(groupRows, columns));
            lines.push('');
        });
    } else if (groupBy === 'area') {
        const map = new Map();
        visibleRows.forEach(row => {
            const key = row.node.area || 'Sem área';
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(row);
        });
        [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR')).forEach(([groupName, groupRows]) => {
            lines.push(`[${groupName}]`);
            lines.push(buildTeamsTable(groupRows, columns));
            lines.push('');
        });
    } else if (groupBy === 'stack') {
        const map = new Map();
        visibleRows.forEach(row => {
            const key = (row.node.stackTags && row.node.stackTags.length > 0) ? row.node.stackTags.join(' + ') : 'Sem stack';
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(row);
        });
        [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR')).forEach(([groupName, groupRows]) => {
            lines.push(`[${groupName}]`);
            lines.push(buildTeamsTable(groupRows, columns));
            lines.push('');
        });
    } else {
        lines.push(buildTeamsTable(visibleRows, columns));
    }

    return lines.join('\n').trim();
}

function buildExportHtmlTable(rows, columns) {
    const headers = {
        id: 'ID',
        title: 'Card',
        type: 'Tipo',
        state: 'Estado',
        stack: 'Stack',
        qa: 'QA',
        tags: 'Tags',
        release: 'Liberação',
        issues: 'Problemas',
        area: 'Área'
    };
    const data = buildExportRowData(rows);
    const thStyle = 'border:1px solid #94a3b8; padding:6px 8px; background:#0f172a; color:#ffffff; text-align:left; vertical-align:top;';
    const tdStyle = 'border:1px solid #94a3b8; padding:6px 8px; color:#111827; vertical-align:top; white-space:normal; overflow-wrap:anywhere;';

    const headerHtml = `<tr>${columns.map(col => `<th style="${thStyle}">${escapeHtml(headers[col])}</th>`).join('')}</tr>`;
    const bodyHtml = data.map(row => `<tr>${columns.map(col => `<td style="${tdStyle}">${escapeHtml(row[col] || '')}</td>`).join('')}</tr>`).join('');

    return `
        <div style="width:100%; overflow-x:auto;">
            <table style="border-collapse:collapse; width:100%; table-layout:fixed; font-family:Segoe UI, Arial, sans-serif; font-size:12px;">
                <thead>${headerHtml}</thead>
                <tbody>${bodyHtml}</tbody>
            </table>
        </div>
    `.trim();
}

function buildDeployExportText(rows, options) {
    return buildExportPlainText(rows, options);
}

function buildDeployExportHtml(rows, options) {
    const groupBy = options.groupBy || 'none';
    const columns = options.columns || ['id', 'title', 'type', 'qa', 'release'];
    const visibleRows = rows.filter(({ node }) => matchesDeployExportFilters(node, options));

    const sprintName = (options.iterationPath || '').split('\\').pop() || options.iterationPath || 'Sprint';
    const sections = [];
    const makeSection = (title, rowsForSection) => {
        sections.push(`
            <h3 style="font-family:Segoe UI, Arial, sans-serif; color:#0f172a; margin:16px 0 8px 0;">${escapeHtml(title)}</h3>
            ${buildExportHtmlTable(rowsForSection, columns)}
        `);
    };

    if (groupBy === 'responsible') {
        const map = new Map();
        visibleRows.forEach(row => {
            const names = row.node.qaResponsibles && row.node.qaResponsibles.length > 0 ? row.node.qaResponsibles : ['Sem responsável'];
            names.forEach(name => {
                if (!map.has(name)) map.set(name, []);
                map.get(name).push(row);
            });
        });
        [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR')).forEach(([groupName, groupRows]) => makeSection(groupName, groupRows));
    } else if (groupBy === 'type') {
        const map = new Map();
        visibleRows.forEach(row => {
            const key = row.node.type || 'Sem tipo';
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(row);
        });
        [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR')).forEach(([groupName, groupRows]) => makeSection(groupName, groupRows));
    } else if (groupBy === 'area') {
        const map = new Map();
        visibleRows.forEach(row => {
            const key = row.node.area || 'Sem área';
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(row);
        });
        [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR')).forEach(([groupName, groupRows]) => makeSection(groupName, groupRows));
    } else if (groupBy === 'stack') {
        const map = new Map();
        visibleRows.forEach(row => {
            const key = (row.node.stackTags && row.node.stackTags.length > 0) ? row.node.stackTags.join(' + ') : 'Sem stack';
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(row);
        });
        [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR')).forEach(([groupName, groupRows]) => makeSection(groupName, groupRows));
    } else {
        sections.push(buildExportHtmlTable(visibleRows, columns));
    }

    return `
        <div style="font-family:Segoe UI, Arial, sans-serif; color:#111827;">
            <div style="margin-bottom:8px;"><strong>Deploy ${escapeHtml(sprintName)}</strong></div>
            ${options.iterationPath ? `<div style="margin-bottom:4px;">Sprint: ${escapeHtml(options.iterationPath)}</div>` : ''}
            <div style="margin-bottom:4px;">Gerado em: ${escapeHtml(new Date().toLocaleString('pt-BR'))}</div>
            <div style="margin-bottom:4px;">Itens exportados: ${visibleRows.length}</div>
            ${sections.join('')}
        </div>
    `.trim();
}

async function copyRichTeamsExport(html, text) {
    const htmlBlob = new Blob([html], { type: 'text/html' });
    const textBlob = new Blob([text], { type: 'text/plain' });

    if (navigator.clipboard && window.ClipboardItem) {
        try {
            await navigator.clipboard.write([
                new ClipboardItem({
                    'text/html': htmlBlob,
                    'text/plain': textBlob
                })
            ]);
            return;
        } catch {
            // fallback to plain text
        }
    }

    await navigator.clipboard.writeText(text);
}

function openDeployExportModal(context) {
    const existing = document.getElementById('qualiflow-export-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'qualiflow-export-modal-overlay';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.background = 'rgba(15, 23, 42, 0.78)';
    overlay.style.zIndex = '2147483647';
    overlay.style.padding = '16px';
    overlay.style.boxSizing = 'border-box';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.innerHTML = `
        <div style="width:min(1100px, calc(100vw - 32px)); max-height:calc(100vh - 32px); overflow:auto; background:#0f172a; border:1px solid #334155; border-radius:12px; box-shadow:0 24px 80px rgba(0,0,0,.45);">
            <div style="display:flex; justify-content:space-between; align-items:center; padding:14px 16px; border-bottom:1px solid #334155;">
                <div>
                    <div style="font-size:1rem; font-weight:700; color:#e2e8f0;">Exportar lista</div>
                    <div style="font-size:0.8rem; color:#94a3b8;">Ajuste os filtros e copie uma tabela pronta para o Teams.</div>
                </div>
                <button id="qualiflow-export-close" class="qualiflow-btn-inline qualiflow-btn-secondary" style="margin:0;">Fechar</button>
            </div>
            <div style="padding:16px;">
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:12px; margin-bottom:12px;">
                    <select id="qualiflow-export-groupby" class="qualiflow-select-input" style="width:100%; background:#0b1220; color:#e2e8f0; border:1px solid #475569; border-radius:8px; padding:10px 12px;">
                        <option value="none">Sem agrupamento</option>
                        <option value="responsible">Agrupar por responsável</option>
                        <option value="type">Agrupar por tipo</option>
                        <option value="area">Agrupar por área</option>
                        <option value="stack">Agrupar por stack</option>
                    </select>
                    <select id="qualiflow-export-release" class="qualiflow-select-input" style="width:100%; background:#0b1220; color:#e2e8f0; border:1px solid #475569; border-radius:8px; padding:10px 12px;">
                        <option value="all">Todas as liberações</option>
                        <option value="yes">Somente liberados</option>
                        <option value="pending">Somente pendentes</option>
                        <option value="no">Somente com problema</option>
                    </select>
                    <div id="qualiflow-export-responsibles" class="qualiflow-multi-select">
                        <button type="button" class="qualiflow-select-input qualiflow-multi-select-trigger" title="Selecione responsáveis" style="width:100%; background:#0b1220; color:#e2e8f0; border:1px solid #475569; border-radius:8px; padding:10px 12px;">
                            <span class="qualiflow-multi-select-label">Responsáveis: Todos</span>
                            <span class="qualiflow-multi-select-arrow">▼</span>
                        </button>
                        <div class="qualiflow-multi-select-panel"></div>
                    </div>
                    <div id="qualiflow-export-types" class="qualiflow-multi-select">
                        <button type="button" class="qualiflow-select-input qualiflow-multi-select-trigger" title="Selecione tipos" style="width:100%; background:#0b1220; color:#e2e8f0; border:1px solid #475569; border-radius:8px; padding:10px 12px;">
                            <span class="qualiflow-multi-select-label">Tipos: Todos</span>
                            <span class="qualiflow-multi-select-arrow">▼</span>
                        </button>
                        <div class="qualiflow-multi-select-panel"></div>
                    </div>
                </div>
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(110px, 1fr)); gap:8px; margin-bottom:12px;">
                    <label style="color:#cbd5e1;"><input type="checkbox" id="qualiflow-export-col-id" checked /> ID</label>
                    <label style="color:#cbd5e1;"><input type="checkbox" id="qualiflow-export-col-title" checked /> Card</label>
                    <label style="color:#cbd5e1;"><input type="checkbox" id="qualiflow-export-col-type" checked /> Tipo</label>
                    <label style="color:#cbd5e1;"><input type="checkbox" id="qualiflow-export-col-state" /> Estado</label>
                    <label style="color:#cbd5e1;"><input type="checkbox" id="qualiflow-export-col-stack" /> Stack</label>
                    <label style="color:#cbd5e1;"><input type="checkbox" id="qualiflow-export-col-qa" checked /> QA</label>
                    <label style="color:#cbd5e1;"><input type="checkbox" id="qualiflow-export-col-tags" /> Tags</label>
                    <label style="color:#cbd5e1;"><input type="checkbox" id="qualiflow-export-col-release" checked /> Liberação</label>
                    <label style="color:#cbd5e1;"><input type="checkbox" id="qualiflow-export-col-issues" /> Problemas</label>
                    <label style="color:#cbd5e1;"><input type="checkbox" id="qualiflow-export-col-area" /> Área</label>
                </div>
                <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px;">
                    <button id="qualiflow-export-copy" class="qualiflow-btn qualiflow-btn-primary" style="margin:0; padding:10px 14px;">Copiar para Teams</button>
                    <button id="qualiflow-export-refresh" class="qualiflow-btn qualiflow-btn-secondary" style="margin:0; padding:10px 14px;">Atualizar preview</button>
                </div>
                <div style="display:grid; grid-template-columns:1fr; gap:12px;">
                    <div>
                        <div style="font-size:0.85rem; color:#94a3b8; margin-bottom:6px;">Prévia texto</div>
                        <textarea id="qualiflow-export-output" readonly spellcheck="false" style="width:100%; min-height:220px; background:#020617; color:#e2e8f0; border:1px solid #334155; border-radius:6px; padding:12px; font-family:monospace; font-size:0.78rem; line-height:1.4;"></textarea>
                    </div>
                    <div>
                        <div style="font-size:0.85rem; color:#94a3b8; margin-bottom:6px;">Prévia HTML para Teams</div>
                        <div id="qualiflow-export-html-preview" style="background:#ffffff; border:1px solid #cbd5e1; border-radius:6px; padding:12px; overflow:auto; max-height:340px;"></div>
                    </div>
                </div>
                <div id="qualiflow-export-feedback" style="margin-top:8px; color:#94a3b8; font-size:0.8rem;"></div>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const modal = {
        overlay,
        responsiblesSelect: overlay.querySelector('#qualiflow-export-responsibles'),
        typesSelect: overlay.querySelector('#qualiflow-export-types'),
        groupBySelect: overlay.querySelector('#qualiflow-export-groupby'),
        exportReleaseSelect: overlay.querySelector('#qualiflow-export-release'),
        outputEl: overlay.querySelector('#qualiflow-export-output'),
        htmlPreviewEl: overlay.querySelector('#qualiflow-export-html-preview'),
        feedbackEl: overlay.querySelector('#qualiflow-export-feedback'),
        closeBtn: overlay.querySelector('#qualiflow-export-close'),
        copyBtn: overlay.querySelector('#qualiflow-export-copy'),
        refreshBtn: overlay.querySelector('#qualiflow-export-refresh')
    };

    const uniqueResponsibles = [...new Set(context.rows.flatMap(({ node }) => node.qaResponsibles || []))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const uniqueTypes = [...new Set(context.rows.map(({ node }) => node.type || 'Sem tipo'))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const responsiblesMulti = initMultiSelectDropdown(modal.responsiblesSelect, {
        placeholder: 'Responsáveis',
        onChange: () => refresh()
    });
    const typesMulti = initMultiSelectDropdown(modal.typesSelect, {
        placeholder: 'Tipos',
        onChange: () => refresh()
    });

    responsiblesMulti?.setOptions(uniqueResponsibles);
    typesMulti?.setOptions(uniqueTypes);

    const exportState = {
        groupBy: 'none',
        release: 'all',
        responsibles: uniqueResponsibles,
        types: uniqueTypes,
        columns: getDeployExportColumns()
    };

    const refresh = () => {
        exportState.groupBy = modal.groupBySelect.value;
        exportState.release = modal.exportReleaseSelect.value;
        exportState.responsibles = responsiblesMulti?.getSelectedValues?.() || [];
        exportState.types = typesMulti?.getSelectedValues?.() || [];
        exportState.columns = getDeployExportColumns();

        const exportRows = context.rows.filter(({ node }) => matchesDeployExportFilters(node, exportState));

        const plain = buildDeployExportText(exportRows, {
            iterationPath: context.iterationPath,
            groupBy: exportState.groupBy,
            release: exportState.release,
            responsibles: exportState.responsibles,
            types: exportState.types,
            columns: exportState.columns
        });
        const html = buildDeployExportHtml(exportRows, {
            iterationPath: context.iterationPath,
            groupBy: exportState.groupBy,
            release: exportState.release,
            responsibles: exportState.responsibles,
            types: exportState.types,
            columns: exportState.columns
        });

        modal.outputEl.value = plain;
        modal.htmlPreviewEl.innerHTML = html;
        modal.feedbackEl.textContent = `${exportRows.length} item(ns) prontos para exportação.`;
        context.exportState = exportState;
        context.exportRows = exportRows;
        context.exportPlain = plain;
        context.exportHtml = html;
    };

    [modal.responsiblesSelect, modal.typesSelect, modal.groupBySelect, modal.exportReleaseSelect].forEach(el => {
        el.addEventListener('change', refresh);
    });
    modal.refreshBtn.addEventListener('click', refresh);
    modal.copyBtn.addEventListener('click', async () => {
        try {
            await copyRichTeamsExport(context.exportHtml || '', context.exportPlain || '');
            modal.feedbackEl.textContent = 'Exportação copiada. Cole diretamente no Teams.';
        } catch (err) {
            modal.feedbackEl.textContent = `Falha ao copiar: ${err.message}`;
        }
    });
    modal.closeBtn.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.remove();
    });
    const destroyMulti = () => {
        responsiblesMulti?.destroy?.();
        typesMulti?.destroy?.();
    };
    modal.closeBtn.addEventListener('click', destroyMulti);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) destroyMulti();
    });
    refresh();
}

function renderDeployResults(cards, container, payload = null) {
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
        container.innerHTML = '<div class="qualiflow-info">Nenhum card encontrado nesta sprint.</div>';
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
        <div style="margin-bottom:16px; padding:12px; background-color:#0f172a; border-radius:6px; border-left:3px solid ${approved === total ? '#10b981' : '#f59e0b'};">
            <div style="font-size:0.9rem; color:#e2e8f0;">
                <strong>${approved}/${total}</strong> cards liberados para deploy
                <span style="margin-left:8px; color:#94a3b8;">
                    (${resolvedSummary.problemas || 0} com problema, ${resolvedSummary.pendentes || 0} pendentes)
                </span>
            </div>
        </div>
    `;
    container.appendChild(summaryBox);

    const ruleBox = document.createElement('div');
    ruleBox.style.marginBottom = '16px';
    ruleBox.style.padding = '12px';
    ruleBox.style.backgroundColor = '#111827';
    ruleBox.style.border = '1px solid #334155';
    ruleBox.style.borderRadius = '6px';
    ruleBox.style.color = '#cbd5e1';
    ruleBox.style.fontSize = '0.85rem';
    ruleBox.innerHTML = `
        <div style="font-weight:600; color:#e2e8f0; margin-bottom:6px;">Regra usada na validação</div>
        <div>Conta como <strong>liberado</strong> quando existe stack, a tag <strong>Liberado deploy</strong> e a lógica do card pai/filho não cria bloqueio.</div>
        <div style="margin-top:6px; color:#94a3b8;">Task/Fix herdam o estado do PBI pai. Ocorrência em Done/Closed não entra na lista.</div>
    `;
    container.appendChild(ruleBox);

    const filterBox = document.createElement('div');
    filterBox.style.marginBottom = '16px';
    filterBox.style.padding = '12px';
    filterBox.style.backgroundColor = '#0f172a';
    filterBox.style.border = '1px solid #334155';
    filterBox.style.borderRadius = '8px';
    filterBox.innerHTML = `
        <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start; flex-wrap:wrap;">
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:10px; flex:1;">
                <input id="qualiflow-deploy-search" type="text" class="qualiflow-input-edit" placeholder="Buscar por ID, nome, tipo, QA..." style="width:100%;" />
                <div id="qualiflow-deploy-filter-type" class="qualiflow-multi-select">
                    <button type="button" class="qualiflow-select-input qualiflow-multi-select-trigger" title="Selecione os tipos" style="width:100%;">
                        <span class="qualiflow-multi-select-label">Tipo: Todos</span>
                        <span class="qualiflow-multi-select-arrow">▼</span>
                    </button>
                    <div class="qualiflow-multi-select-panel"></div>
                </div>
                <select id="qualiflow-deploy-filter-state" class="qualiflow-select-input" style="width:100%;">
                    <option value="all">Todos os estados</option>
                </select>
                <div id="qualiflow-deploy-filter-qa" class="qualiflow-multi-select">
                    <button type="button" class="qualiflow-select-input qualiflow-multi-select-trigger" title="Selecione os QA" style="width:100%;">
                        <span class="qualiflow-multi-select-label">QA: Todos</span>
                        <span class="qualiflow-multi-select-arrow">▼</span>
                    </button>
                    <div class="qualiflow-multi-select-panel"></div>
                </div>
                <select id="qualiflow-deploy-filter-stack" class="qualiflow-select-input" style="width:100%;">
                    <option value="all">Toda stack</option>
                    <option value="front">Front</option>
                    <option value="back">Back</option>
                    <option value="tecnica">Técnica</option>
                    <option value="front+back">Front + Back</option>
                    <option value="none">Sem stack</option>
                </select>
                <select id="qualiflow-deploy-filter-release" class="qualiflow-select-input" style="width:100%;">
                    <option value="all">Toda liberação</option>
                    <option value="yes">Liberado</option>
                    <option value="pending">Pendente</option>
                    <option value="no">Com problema</option>
                </select>
            </div>
            <button id="qualiflow-deploy-filter-clear" class="qualiflow-btn qualiflow-btn-secondary" style="margin:0; padding:10px 14px;">Limpar filtros</button>
        </div>
        <div id="qualiflow-deploy-filter-info" style="margin-top:10px; color:#94a3b8; font-size:0.8rem;"></div>
    `;
    container.appendChild(filterBox);

    const chartsBox = document.createElement('div');
    chartsBox.id = 'qualiflow-deploy-charts';
    chartsBox.style.marginBottom = '16px';
    container.appendChild(chartsBox);

    const tableWrap = document.createElement('div');
    tableWrap.id = 'qualiflow-deploy-table-wrap';
    tableWrap.style.overflowX = 'auto';
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
    if (stateSelect) stateSelect.innerHTML += allStates.map(state => `<option value="${normalizeDeployText(state)}">${state}</option>`).join('');
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
            tableWrap.innerHTML = '<div class="qualiflow-info">Nenhum card corresponde aos filtros atuais.</div>';
            return;
        }

        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        table.style.fontSize = '0.85rem';

        table.innerHTML = `
            <thead>
                <tr style="text-align:left; color:#94a3b8; border-bottom:1px solid #334155;">
                    <th style="padding:10px 8px;">ID</th>
                    <th style="padding:10px 8px;">Card</th>
                    <th style="padding:10px 8px;">Tipo</th>
                    <th style="padding:10px 8px;">Estado</th>
                    <th style="padding:10px 8px;">Stack</th>
                    <th style="padding:10px 8px;">QA</th>
                    <th style="padding:10px 8px;">Tags</th>
                    <th style="padding:10px 8px;">Liberação</th>
                    <th style="padding:10px 8px;">Problemas</th>
                    <th style="padding:10px 8px;">Ação</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;

        const tbody = table.querySelector('tbody');
        rows.forEach(({ node, depth }) => {
            const row = document.createElement('tr');
            row.style.borderBottom = '1px solid #1f2937';

            const liberadoText = node.liberado === 'yes' ? 'Liberado' : node.liberado === 'pending' ? 'Pendente' : 'Com problema';
            const liberadoColor = node.liberado === 'yes' ? '#10b981' : node.liberado === 'pending' ? '#f59e0b' : '#ef4444';
            const problemText = node.issues && node.issues.length > 0 ? node.issues.join('; ') : '—';
            const stackText = (node.stackTags && node.stackTags.length > 0) ? node.stackTags.join(' + ') : '—';
            const qaText = (node.qaResponsibles && node.qaResponsibles.length > 0) ? node.qaResponsibles.join(', ') : '—';
            const deployText = node.hasDeployTag ? 'Liberado deploy' : '—';
            const indent = `${depth * 18}px`;
            const prefix = depth > 0 ? '↳ ' : '';
            const effectiveState = node.effectiveState || node.state || '—';
            const actualState = node.state || '—';
            const stateText = effectiveState === actualState ? effectiveState : `${effectiveState} <span style="color:#64748b; font-size:0.75rem;">(orig: ${actualState})</span>`;
            const tagsText = [deployText].filter(Boolean).join(' / ') || '—';

            row.innerHTML = `
                <td style="padding:10px 8px; color:#e2e8f0;">#${node.id}</td>
                <td style="padding:10px 8px; color:#e2e8f0; padding-left:${indent};">${prefix}${node.title}</td>
                <td style="padding:10px 8px; color:#94a3b8;">${node.type || '—'}</td>
                <td style="padding:10px 8px; color:#94a3b8;">${stateText}</td>
                <td style="padding:10px 8px; color:#94a3b8;">${stackText}</td>
                <td style="padding:10px 8px; color:#94a3b8;">${qaText}</td>
                <td style="padding:10px 8px; color:#94a3b8;">${tagsText}</td>
                <td style="padding:10px 8px; color:${liberadoColor}; font-weight:600;">${liberadoText}</td>
                <td style="padding:10px 8px; color:#94a3b8;">${problemText}</td>
                <td style="padding:10px 8px;">
                    <a href="${node.url || '#'}" target="_blank" class="qualiflow-btn-inline qualiflow-btn-secondary" style="text-decoration:none; padding:6px 12px; font-size:0.75rem;">Abrir</a>
                </td>
            `;
            tbody.appendChild(row);
        });

        tableWrap.innerHTML = '';
        tableWrap.appendChild(table);
    };

    const exportBar = document.createElement('div');
    exportBar.style.marginBottom = '16px';
    exportBar.style.padding = '12px';
    exportBar.style.backgroundColor = '#0f172a';
    exportBar.style.border = '1px solid #334155';
    exportBar.style.borderRadius = '8px';
    exportBar.innerHTML = `
        <div style="display:flex; justify-content:space-between; gap:12px; align-items:center; flex-wrap:wrap;">
            <div>
                <div style="font-weight:600; color:#e2e8f0; margin-bottom:4px;">Exportar lista para Teams</div>
                <div style="color:#94a3b8; font-size:0.8rem;">Abre uma modal com filtros e saída formatada em tabela.</div>
            </div>
            <button id="qualiflow-open-export-modal" class="qualiflow-btn qualiflow-btn-primary" style="margin:0; padding:10px 14px;">Exportar</button>
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

function initDashboardTabs() {
    const tabCards = document.getElementById('qualiflow-tab-cards');
    const tabAnalytics = document.getElementById('qualiflow-tab-analytics');
    const tabSupport = document.getElementById('qualiflow-tab-support');
    const tabDeploy = document.getElementById('qualiflow-tab-deploy');
    const contentCards = document.getElementById('qualiflow-dashboard-cards');
    const contentAnalytics = document.getElementById('qualiflow-dashboard-analytics');
    const contentSupport = document.getElementById('qualiflow-dashboard-support');
    const contentDeploy = document.getElementById('qualiflow-dashboard-deploy');

    if (!tabCards || !tabSupport || !tabDeploy || !contentCards || !contentSupport || !contentDeploy) return;

    const tabs = [tabCards, tabAnalytics, tabSupport, tabDeploy].filter(Boolean);
    const contents = [contentCards, contentAnalytics, contentSupport, contentDeploy].filter(Boolean);

    const activateTab = (activeTab, activeContent) => {
        tabs.forEach((tab) => {
            tab.classList.remove('qualiflow-tab-active');
            tab.style.color = '#94a3b8';
            tab.style.borderBottomColor = 'transparent';
        });
        contents.forEach((content) => {
            if (content) content.classList.add('qualiflow-hidden');
        });

        activeTab.classList.add('qualiflow-tab-active');
        activeTab.style.color = '#e2e8f0';
        activeTab.style.borderBottomColor = '#3b82f6';
        if (activeContent) activeContent.classList.remove('qualiflow-hidden');
    };

    if (tabCards.dataset.bound === '1') {
        return;
    }
    tabCards.dataset.bound = '1';

    tabCards.addEventListener('click', () => {
        activateTab(tabCards, contentCards);
    });

    if (tabAnalytics && contentAnalytics) {
        tabAnalytics.addEventListener('click', () => {
            activateTab(tabAnalytics, contentAnalytics);
            try {
                if (currentAnalyticsData && Array.isArray(currentAnalyticsData.items) && currentAnalyticsData.items.length > 0) {
                    renderAnalyticsDashboard(currentAnalyticsData);
                } else {
                    loadAnalyticsDashboardData();
                }
            } catch (err) {
                console.error('[QualiFlow] Erro ao renderizar Analytics Pro:', err);
                contentAnalytics.innerHTML = '<div class="qualiflow-error">Falha ao carregar Analytics Pro. Verifique os dados e tente novamente.</div>';
            }
        });
    }

    tabSupport.addEventListener('click', () => {
        activateTab(tabSupport, contentSupport);

        if (currentSupportCardsData === null) {
            loadSupportCards();
        } else {
            renderSupportCards(currentSupportCardsData);
        }
    });

    tabDeploy.addEventListener('click', () => {
        activateTab(tabDeploy, contentDeploy);
        
        if (!contentDeploy.innerHTML.trim()) {
            renderDeployValidation();
            setTimeout(() => {
                const validateBtn = document.getElementById('qualiflow-deploy-validate-btn');
                if (validateBtn) {
                    validateBtn.addEventListener('click', validateDeployCards);
                }
            }, 50);
        }
    });

    if (tabAnalytics && contentAnalytics) {
        activateTab(tabAnalytics, contentAnalytics);
        if (currentAnalyticsData && Array.isArray(currentAnalyticsData.items) && currentAnalyticsData.items.length > 0) {
            renderAnalyticsDashboard(currentAnalyticsData);
        } else {
            loadAnalyticsDashboardData();
        }
    } else {
        activateTab(tabCards, contentCards);
    }
}

globalThis.renderDashboard = renderDashboard;
globalThis.initDashboardTabs = initDashboardTabs;
