function onEvaluateCoverage() {
    const btn = document.getElementById('btn-eval');
    btn.disabled = true;
    btn.textContent = 'Avaliando...';
    const resDiv = document.getElementById('qualiflow-eval-result');
    resDiv.classList.add('qualiflow-hidden');

    sendRuntimeMessage({ action: "EVALUATE_COVERAGE", cardData: currentWorkItemData }, (response) => {
        btn.disabled = false;
        btn.textContent = '🔍 Avaliar Cobertura Atual';
        if (response && response.error) {
            resDiv.textContent = `Erro: ${response.error} `;
            resDiv.classList.remove('qualiflow-hidden');
            resDiv.className = 'qualiflow-eval-result error';
        } else {
            resDiv.textContent = response?.result || '';
            resDiv.classList.remove('qualiflow-hidden');
            resDiv.className = 'qualiflow-eval-result';
        }
    });
}

const qualiflowBridgeScenarios = window.qualiflowBridge;

function readLocalStorage(keys, callback) {
    if (qualiflowBridgeScenarios && typeof qualiflowBridgeScenarios.getStorage === 'function') {
        qualiflowBridgeScenarios.getStorage(keys, callback);
        return;
    }
    chrome.storage.local.get(keys, callback);
}

function writeLocalStorage(payload, callback) {
    if (qualiflowBridgeScenarios && typeof qualiflowBridgeScenarios.setStorage === 'function') {
        qualiflowBridgeScenarios.setStorage(payload, callback);
        return;
    }
    chrome.storage.local.set(payload, callback);
}

const generationProgressState = {
    visible: false,
    currentStage: 'idle',
    batchLabel: ''
};

function ensureGenerationProgressUI() {
    const layoutEl = document.getElementById('qualiflow-generation-layout');
    if (!layoutEl) return null;

    let box = document.getElementById('qualiflow-generation-progress');
    if (!box) {
        box = document.createElement('div');
        box.id = 'qualiflow-generation-progress';
        box.className = 'qualiflow-gen-progress-overlay qualiflow-hidden';
        box.innerHTML = `
            <div class="qualiflow-gen-progress-shell">
                <div class="qualiflow-gen-progress-head">
                    <span class="qualiflow-gen-spinner"></span>
                    <span id="qualiflow-gen-main-label">Preparando geracao...</span>
                </div>
                <div class="qualiflow-gen-steps">
                    <div class="qualiflow-gen-step" data-stage="analyzing">Analisando regras e criterios...</div>
                    <div class="qualiflow-gen-step" data-stage="batch">Gerando cenarios de teste...</div>
                    <div class="qualiflow-gen-step" data-stage="rtm">Montando matriz RTM e cobertura...</div>
                    <div class="qualiflow-gen-step" data-stage="postprocess">Consolidando resultado final...</div>
                </div>
                <div id="qualiflow-gen-batch-label" class="qualiflow-gen-batch-label"></div>
            </div>
        `;
        layoutEl.appendChild(box);
    }

    return box;
}

function setGenerationProgress(stage, message, meta = {}) {
    const box = ensureGenerationProgressUI();
    if (!box) return;

    const mainLabel = document.getElementById('qualiflow-gen-main-label');
    const batchLabel = document.getElementById('qualiflow-gen-batch-label');
    if (mainLabel && message) mainLabel.textContent = message;

    const stageMap = {
        start: 'analyzing',
        analyzing: 'analyzing',
        'batch-start': 'batch',
        'batch-progress': 'batch',
        rtm: 'rtm',
        postprocess: 'postprocess',
        fallback: 'batch',
        done: 'done',
        error: 'error'
    };

    const mapped = stageMap[stage] || 'analyzing';
    generationProgressState.currentStage = mapped;
    generationProgressState.visible = true;

    box.classList.remove('qualiflow-hidden');

    const order = ['analyzing', 'batch', 'rtm', 'postprocess'];
    const activeIndex = order.indexOf(mapped);
    box.querySelectorAll('.qualiflow-gen-step').forEach((stepEl, idx) => {
        stepEl.classList.remove('is-active', 'is-done');
        if (mapped !== 'error' && mapped !== 'done' && idx < activeIndex) stepEl.classList.add('is-done');
        if (mapped !== 'error' && mapped !== 'done' && idx === activeIndex) stepEl.classList.add('is-active');
        if (mapped === 'done') stepEl.classList.add('is-done');
    });

    if (batchLabel) {
        const hasBatch = Number(meta.batchIndex) > 0 && Number(meta.totalBatches) > 0;
        batchLabel.textContent = hasBatch
            ? `Lote ${meta.batchIndex} de ${meta.totalBatches}`
            : '';
    }

    if (mapped === 'done') {
        setTimeout(() => hideGenerationProgress(), 1400);
    }
}

function hideGenerationProgress() {
    const box = document.getElementById('qualiflow-generation-progress');
    if (!box) return;
    box.classList.add('qualiflow-hidden');
    const layoutEl = document.getElementById('qualiflow-generation-layout');
    if (layoutEl) layoutEl.classList.remove('qualiflow-loading-active');
    generationProgressState.visible = false;
    generationProgressState.currentStage = 'idle';
}

if (!window.__qualiflowGenerationProgressListenerAttached) {
    window.__qualiflowGenerationProgressListenerAttached = true;
    chrome.runtime.onMessage.addListener((message) => {
        if (message?.action !== 'GENERATION_PROGRESS') return;
        setGenerationProgress(message.stage, message.message, message);
    });
}

function onGenerateScenarios() {
    const btn = document.getElementById('btn-generate');
    btn.disabled = true;
    btn.textContent = 'Gerando (aguarde)...';

    const userFocus = document.getElementById('qualiflow-user-focus').value;
    const technicalDetail = document.getElementById('qualiflow-technical-detail').value;
    const editedAcceptance = (document.getElementById('qualiflow-acceptance-criteria') && document.getElementById('qualiflow-acceptance-criteria').value) || '';

    // Novas categorias de seleção
    const generationSettings = {
        objective: document.getElementById('qualiflow-select-objective').value,
        type: document.getElementById('qualiflow-select-type').value,
        granularity: document.getElementById('qualiflow-select-granularity').value,
        dataLevel: document.getElementById('qualiflow-select-data').value
    };

    setGenerationProgress('start', 'Preparando analise da historia...');
    const layoutEl = document.getElementById('qualiflow-generation-layout');
    if (layoutEl) layoutEl.classList.add('qualiflow-loading-active');

    document.getElementById('qualiflow-col-scenarios').classList.remove('qualiflow-hidden');
    document.getElementById('qualiflow-col-rtm').classList.remove('qualiflow-hidden');

    sendRuntimeMessage({
        action: "GENERATE_SCENARIOS",
        cardData: Object.assign({}, currentWorkItemData, { acceptance_criteria: editedAcceptance || currentWorkItemData.acceptance_criteria }),
        userFocus,
        technicalDetail,
        generationSettings
    }, (response) => {
        btn.disabled = false;
        btn.textContent = 'Gerar Novamente';

        if (response && response.error) {
            setGenerationProgress('error', `Erro na geracao: ${response.error}`);
            hideGenerationProgress();
            alert("Erro na geração: " + response.error);
            return;
        }

        currentCopyContext = null;
        syncCopyFlowButtons();
        currentScenarios = response?.scenarios || [];
        renderScenarios(currentScenarios, { showRtm: true });
        setGenerationProgress('done', 'Cenarios finalizados com sucesso.');
    });
}

function setRtmVisibility(visible) {
    const rtmCol = document.getElementById('qualiflow-col-rtm');
    if (!rtmCol) return;
    if (visible) rtmCol.classList.remove('qualiflow-hidden');
    else rtmCol.classList.add('qualiflow-hidden');
}

function syncCopyFlowButtons() {
    const autoBtn = document.getElementById('btn-copy-auto-adjust');
    if (!autoBtn) return;

    const isManualCopyFlow = currentCopyContext && currentCopyContext.mode === 'manual';
    autoBtn.classList.toggle('qualiflow-hidden', !isManualCopyFlow);
}

function buildCopiedBddDescription(steps) {
    if (!steps || steps.length === 0) return 'DADO contexto do card\nQUANDO executa o fluxo\nENTAO valida resultado esperado';

    const lines = [];
    for (let i = 0; i < Math.min(steps.length, 6); i += 1) {
        const step = steps[i];
        const raw = String(step.action || '').trim();
        const normalized = raw
            .replace(/^\s*(DADO|E|QUANDO|ENTAO|ENTÃO)\s*/i, '')
            .trim();

        if (i === 0) lines.push(`DADO ${normalized || 'contexto inicial do cenário'}`);
        else if (i === 1) lines.push(`E ${normalized || 'pré-condição complementar'}`);
        else if (i === 2) lines.push(`QUANDO ${normalized || 'executa a ação principal'}`);
        else if (i === 3) lines.push(`ENTAO ${normalized || 'obtém o resultado esperado'}`);
        else lines.push(`E ${normalized || 'validações adicionais'}`);
    }

    return lines.join('\n');
}

function convertTestCaseToScenario(tc, sourceCard) {
    const rawSteps = Array.isArray(tc.steps) ? tc.steps : [];
    const steps = rawSteps.map((step) => {
        const actionRaw = String(step.action || '').trim();
        const action = actionRaw || 'DADO executar ação';
        return {
            action,
            expected: String(step.expected || '').trim(),
            needs_evidence: /evidencia|evidência|valida|comprova|resultado/i.test(`${action} ${step.expected || ''}`)
        };
    });

    return {
        id_original: tc.id,
        title: tc.title || `CT #${tc.id}`,
        bdd_description: buildCopiedBddDescription(steps),
        steps,
        parameters: {},
        copied_from: {
            workItemId: sourceCard.id,
            workItemTitle: sourceCard.title,
            testCaseId: tc.id
        }
    };
}

function renderCopySourceCards(cards, listEl, onSelect) {
    if (!listEl) return;
    const filtered = (cards || []).filter((card) => Number(card.id) !== Number(currentWorkItemData?.id));

    if (filtered.length === 0) {
        listEl.innerHTML = '<div style="color:#94a3b8; font-size:12px; padding:8px 0;">Nenhum card com CTs encontrado para reaproveitamento.</div>';
        return;
    }

    listEl.innerHTML = filtered.map((card) => `
        <div style="background:#1e293b; border:1px solid #334155; border-radius:8px; padding:10px; margin-bottom:8px;">
            <div style="font-weight:600; color:#e2e8f0; font-size:12px; margin-bottom:4px;">#${card.id} - ${card.title}</div>
            <div style="color:#94a3b8; font-size:11px; margin-bottom:8px;">${card.type || 'Item'} | ${card.state || 'Sem estado'}</div>
            <button class="qualiflow-copy-source-select" data-id="${card.id}" style="padding:6px 10px; border:none; border-radius:6px; background:#4f46e5; color:white; cursor:pointer; font-size:11px; font-weight:600;">Usar CTs deste card</button>
        </div>
    `).join('');

    listEl.querySelectorAll('.qualiflow-copy-source-select').forEach((btn) => {
        btn.addEventListener('click', () => {
            const cardId = Number(btn.getAttribute('data-id'));
            const selected = filtered.find((c) => Number(c.id) === cardId);
            if (selected) onSelect(selected);
        });
    });
}

function startCopyFromCardFlow() {
    if (!currentWorkItemData || !currentWorkItemData.id) {
        alert('Abra um card alvo antes de copiar CTs de outro card.');
        return;
    }

    const overlayId = 'qualiflow-copy-source-overlay';
    const existing = document.getElementById(overlayId);
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = overlayId;
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(2,6,23,0.78);z-index:2147483644;display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = `
      <div style="width:640px;max-width:96vw;max-height:88vh;background:#0f172a;border:1px solid #334155;border-radius:12px;display:flex;flex-direction:column;overflow:hidden;">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid #1e293b;">
            <div style="font-weight:700;color:#f8fafc;font-size:13px;">Reaproveitar CTs de Outro Card</div>
            <button id="qualiflow-copy-source-close" style="background:transparent;border:none;color:#94a3b8;font-size:18px;cursor:pointer;line-height:1;">✕</button>
        </div>
        <div style="padding:12px 16px;border-bottom:1px solid #1e293b;display:flex;gap:8px;">
            <input id="qualiflow-copy-source-search" type="text" placeholder="Buscar por ID ou título" style="flex:1;background:#1e293b;border:1px solid #334155;border-radius:6px;color:#e2e8f0;padding:8px 10px;font-size:12px;" />
            <button id="qualiflow-copy-source-search-btn" style="padding:8px 12px;background:#6366f1;color:#fff;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;">Buscar</button>
        </div>
        <div id="qualiflow-copy-source-list" style="padding:12px 16px;overflow-y:auto;flex:1;">
            <div style="color:#94a3b8;font-style:italic;font-size:12px;">Carregando cards...</div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    const closeBtn = document.getElementById('qualiflow-copy-source-close');
    if (closeBtn) closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close();
    });

    const listEl = document.getElementById('qualiflow-copy-source-list');
    const runSearch = (query = '') => {
        if (listEl) {
            listEl.innerHTML = '<div style="color:#94a3b8;font-style:italic;font-size:12px;">Buscando cards com CTs...</div>';
        }

        sendRuntimeMessage({ action: 'GET_TEST_RUNNER_CARDS', query }, (response) => {
            if (!response || response.error) {
                if (listEl) listEl.innerHTML = `<div style="color:#ef4444;font-size:12px;">Erro ao buscar cards: ${response?.error || 'desconhecido'}</div>`;
                return;
            }

            renderCopySourceCards(response.data || [], listEl, (sourceCard) => {
                if (listEl) {
                    listEl.innerHTML = '<div style="color:#94a3b8;font-style:italic;font-size:12px;">Carregando CTs do card selecionado...</div>';
                }

                sendRuntimeMessage({ action: 'GET_TEST_CASES_FOR_WORKITEM', workItemId: sourceCard.id }, (tcResponse) => {
                    if (!tcResponse || tcResponse.error) {
                        if (listEl) listEl.innerHTML = `<div style="color:#ef4444;font-size:12px;">Erro ao buscar CTs: ${tcResponse?.error || 'desconhecido'}</div>`;
                        return;
                    }

                    const sourceCases = Array.isArray(tcResponse.data) ? tcResponse.data : [];
                    if (sourceCases.length === 0) {
                        if (listEl) listEl.innerHTML = '<div style="color:#f59e0b;font-size:12px;">O card selecionado não possui CTs vinculados.</div>';
                        return;
                    }

                    currentCopyContext = {
                        mode: 'manual',
                        sourceWorkItemId: sourceCard.id,
                        sourceWorkItemTitle: sourceCard.title,
                        copiedAt: Date.now()
                    };

                    const copiedScenarios = sourceCases.map((tc) => convertTestCaseToScenario(tc, sourceCard));
                    renderScenarios({ test_cases: copiedScenarios }, { showRtm: false, mode: 'copy-manual' });
                    close();
                });
            });
        });
    };

    const searchBtn = document.getElementById('qualiflow-copy-source-search-btn');
    const searchEl = document.getElementById('qualiflow-copy-source-search');
    if (searchBtn) searchBtn.addEventListener('click', () => runSearch(searchEl?.value?.trim() || ''));
    if (searchEl) {
        searchEl.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') runSearch(searchEl.value.trim());
        });
    }

    runSearch('');
}

function onAutoAdjustCopiedScenarios() {
    if (!currentWorkItemData || !currentWorkItemData.id) {
        alert('Abra o card alvo antes de rodar ajustes automáticos.');
        return;
    }

    if (!currentCopyContext || currentCopyContext.mode !== 'manual') {
        alert('Primeiro copie CTs de outro card para habilitar os ajustes automáticos.');
        return;
    }

    if (!Array.isArray(currentScenarios) || currentScenarios.length === 0) {
        alert('Não há CTs copiados para ajustar.');
        return;
    }

    const adjustBtn = document.getElementById('btn-copy-auto-adjust');
    if (adjustBtn) {
        adjustBtn.disabled = true;
        adjustBtn.textContent = 'Ajustando...';
    }

    setGenerationProgress('start', 'Analisando CTs copiados e critérios do card alvo...');
    const layoutEl = document.getElementById('qualiflow-generation-layout');
    if (layoutEl) layoutEl.classList.add('qualiflow-loading-active');

    const editedAcceptance = (document.getElementById('qualiflow-acceptance-criteria') && document.getElementById('qualiflow-acceptance-criteria').value) || '';
    const userFocus = document.getElementById('qualiflow-user-focus').value;
    const technicalDetail = document.getElementById('qualiflow-technical-detail').value;
    const generationSettings = {
        objective: document.getElementById('qualiflow-select-objective').value,
        type: document.getElementById('qualiflow-select-type').value,
        granularity: document.getElementById('qualiflow-select-granularity').value,
        dataLevel: document.getElementById('qualiflow-select-data').value
    };

    sendRuntimeMessage({
        action: 'ADAPT_COPIED_SCENARIOS',
        targetCardData: Object.assign({}, currentWorkItemData, { acceptance_criteria: editedAcceptance || currentWorkItemData.acceptance_criteria }),
        copiedScenarios: currentScenarios,
        copyContext: currentCopyContext,
        userFocus,
        technicalDetail,
        generationSettings
    }, (response) => {
        if (adjustBtn) {
            adjustBtn.disabled = false;
            adjustBtn.innerHTML = '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="vertical-align:text-bottom;margin-right:4px"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"></path></svg> Ajustes Automáticos';
        }

        if (!response || response.error) {
            setGenerationProgress('error', `Erro no ajuste: ${response?.error || 'desconhecido'}`);
            hideGenerationProgress();
            alert(`Erro ao ajustar CTs copiados: ${response?.error || 'desconhecido'}`);
            return;
        }

        currentCopyContext = {
            ...currentCopyContext,
            mode: 'adapted',
            adjustedAt: Date.now()
        };

        syncCopyFlowButtons();
        renderScenarios(response.scenarios || [], { showRtm: true, mode: 'copy-adjusted' });
        setGenerationProgress('done', 'Ajustes automáticos concluídos com RTM atualizado.');
    });
}
function updateSelectionCount() {
    const selectedCount = document.querySelectorAll('.scenario-check:checked').length;
    const totalCount = document.querySelectorAll('.scenario-check').length;
    const countEl = document.getElementById('qualiflow-selection-count');
    if (countEl) countEl.textContent = selectedCount + " / " + totalCount + " selecionados";
}
function onSelectAllToggle(e) {
    const isChecked = e.target.checked;
    document.querySelectorAll('.scenario-check').forEach(chk => {
        chk.checked = isChecked;
    });
    updateSelectionCount();
}
function renderLocalSessions() {
    readLocalStorage(['qualiflowSavedSessions'], (res) => {
        const sessions = res.qualiflowSavedSessions || {};
        const keys = Object.keys(sessions);
        const area = document.getElementById('qualiflow-local-sessions-area');
        if (!area) return;
        if (keys.length === 0) {
            area.style.display = 'none';
            return;
        }
        area.style.display = 'block';
        let html = `<h4 style="margin-bottom:12px; color:#f8fafc;">Cenários Pendentes de Revisão Local:</h4>`;
        keys.forEach(id => {
            const s = sessions[id];
            const dt = new Date(s.timestamp).toLocaleString();
            const scCount = s.scenariosData ? s.scenariosData.length : 0;
            html += `
            <div class="qualiflow-acc-item" style="padding:12px; margin-bottom:8px; display:flex; flex-direction:column; gap:8px;">
                <div style="font-weight:600; color:#e2e8f0;font-size:0.9rem;">#${s.workItem.id} - ${s.workItem.title}</div>
                <div style="font-size:0.75rem; color:#94a3b8;">Salvo em: ${dt} | ${scCount} cenário(s)</div>
                <div style="display:flex; gap:8px;">
                    <button class="qualiflow-btn-inline qualiflow-btn-primary btn-resume-local" data-id="${id}" style="font-size:0.75rem; flex:1;">Continuar Edição</button>
                    <button class="qualiflow-btn-inline qualiflow-btn-secondary btn-delete-local" data-id="${id}" style="font-size:0.75rem; color:#ef4444; border-color:#ef444440;">Excluir</button>
                </div>
            </div>
            `;
        });
        area.innerHTML = html;

        area.querySelectorAll('.btn-resume-local').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const sid = e.target.dataset.id;
                const s = sessions[sid];
                if (s) {
                    hideStatus();
                    area.style.display = 'none';
                    currentWorkItemData = s.workItem;
                    currentScenarios = s.scenariosData;
                    currentCoverageData = s.coverageData || s.scenariosData;
                    currentCopyContext = s.copyContext || null;

                    const titleEl = document.getElementById('qualiflow-wi-title');
                    if (titleEl) titleEl.textContent = `#${currentWorkItemData.id} - ${currentWorkItemData.title} (Revisão Local)`;
                    const metaEl = document.getElementById('qualiflow-wi-meta');
                    if (metaEl) metaEl.textContent = `Tipo: ${currentWorkItemData.type} | Tags: ${currentWorkItemData.tags || 'Nenhuma'} `;

                    document.getElementById('qualiflow-context-area').classList.remove('qualiflow-hidden');
                    document.getElementById('qualiflow-col-scenarios').classList.remove('qualiflow-hidden');
                    document.getElementById('qualiflow-col-rtm').classList.remove('qualiflow-hidden');

                    // Pre-fill ACs
                    const acEl = document.getElementById('qualiflow-acceptance-criteria');
                    if (acEl) acEl.value = htmlToPlainText(currentWorkItemData.acceptance_criteria || '');

                    // Override test cases backwards-compatible logic just in case
                    if (currentCoverageData && currentCoverageData.test_cases) {
                        currentCoverageData.test_cases = currentScenarios;
                    }
                    const shouldShowRtm = !currentCopyContext || currentCopyContext.mode === 'adapted';
                    renderScenarios(currentCoverageData, { showRtm: shouldShowRtm });
                }
            });
        });

        area.querySelectorAll('.btn-delete-local').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const sid = e.target.dataset.id;
                delete sessions[sid];
                writeLocalStorage({ qualiflowSavedSessions: sessions }, renderLocalSessions);
            });
        });
    });
}
function onSaveLocal() {
    if (!currentWorkItemData || !currentWorkItemData.id || !currentScenarios) return;
    const wiId = currentWorkItemData.id;
    readLocalStorage(['qualiflowSavedSessions'], (res) => {
        const sessions = res.qualiflowSavedSessions || {};

        // Ensure coverage data references latest edited scenarios
        if (currentCoverageData) {
            currentCoverageData.test_cases = currentScenarios;
        }

        sessions[wiId] = {
            timestamp: Date.now(),
            workItem: currentWorkItemData,
            scenariosData: currentScenarios,
            coverageData: currentCoverageData,
            copyContext: currentCopyContext
        };
        writeLocalStorage({ qualiflowSavedSessions: sessions }, () => {
            const fb = document.getElementById('save-local-feedback');
            if (fb) {
                fb.classList.remove('qualiflow-hidden');
                setTimeout(() => fb.classList.add('qualiflow-hidden'), 3500);
            }
        });
    });
}
function renderScenarios(data, options = {}) {
    currentCoverageData = data;
    const scenarios = data.test_cases || data;
    currentScenarios = scenarios;
    const showRtm = options.showRtm !== false;
    const list = document.getElementById('qualiflow-scenarios-list');
    const rtmContent = document.getElementById('qualiflow-rtm-content');
    list.innerHTML = '';
    rtmContent.innerHTML = '';

    const scenariosCol = document.getElementById('qualiflow-col-scenarios');
    if (scenariosCol) scenariosCol.classList.remove('qualiflow-hidden');
    setRtmVisibility(showRtm);
    syncCopyFlowButtons();

    if (!showRtm) {
        rtmContent.innerHTML = `
            <div style="padding:12px; border:1px solid #334155; border-radius:8px; background:#1e293b; color:#94a3b8; font-size:12px;">
                RTM oculto neste modo de reaproveitamento manual. Use <strong>Ajustes Automáticos</strong> para adaptar os CTs ao card atual e gerar a matriz de cobertura.
            </div>
        `;
    }

    if (showRtm && data.coverage_analysis) {
        const rtmRows = data.coverage_analysis.rtm_matrix.map((row, idx) => {
            const scns = (row.covered_by_scenarios || []).join(', ');
            const statusLower = (row.status || '').toLowerCase();
            const isCovered = statusLower.includes('good') || statusLower.includes('covered') ||
                statusLower.includes('coberto') || statusLower.includes('parcial') ||
                statusLower.includes('ok') || (row.covered_by_scenarios && row.covered_by_scenarios.length > 0);
            let statusBadge = isCovered
                ? '<span style="color:#10b981;font-weight:600;">✔ Coberto</span>'
                : '<span style="color:#ef4444;font-weight:600;">✖ Falta Teste</span>';
            return `<tr><td>CA${idx + 1}: ${row.criteria}</td><td style="font-size:0.8rem; color:#94a3b8;">${scns || '—'}</td><td>${statusBadge}</td></tr>`;
        }).join('');

        const criteriaList = data.coverage_analysis.rtm_matrix.map((row, idx) => {
            // Strip duplicate AC prefix from criteria if the AI already added it
            const cleanCriteria = row.criteria.replace(/^AC\d+(\.\d+)?:\s*/i, '');
            return `<li style="margin-bottom:6px;"><strong>CA${idx + 1}:</strong> ${cleanCriteria}</li>`;
        }).join('');

        rtmContent.innerHTML = `
            <div class="qualiflow-scenarios-header">
                <h3>Critérios de Aceite</h3>
            </div>
            <div class="qualiflow-azure-html" style="font-size: 0.9rem;">
                <ol style="padding-left: 20px; margin: 0; color: #e2e8f0;">
                    ${criteriaList || '<li>Nenhum critério detectado.</li>'}
                </ol>
            </div>
           
            <div class="qualiflow-scenarios-header" style="margin-top:24px;">
                <h3>Matriz RTM & Inteligência</h3>
            </div>
            <p style="font-size:0.85rem; color:#94a3b8;"><strong>Score:</strong> ${data.coverage_analysis.coverage_score} | <strong>Critérios:</strong> ${data.total_criterios} | <strong>Cenários:</strong> ${data.total_tests}</p>
            <table class="qualiflow-rtm-table" style="margin-bottom:12px;">
                <thead><tr><th>Critério</th><th>Cenários</th><th>Status</th></tr></thead>
                <tbody>${rtmRows}</tbody>
            </table>
            <div class="qualiflow-cobertura-text" style="font-size:0.85rem; color:#cbd5e1; border-left:3px solid #6366f1; padding-left:12px;"><i>Insights: ${data.coverage_analysis.insights}</i></div>
        `;
    }

    const selHeader = document.createElement('div');
    selHeader.className = 'qualiflow-select-all-header';
    selHeader.innerHTML = `
        <input type="checkbox" id="qualiflow-select-all" class="qualiflow-chk qualiflow-chk-large" checked />
        <label for="qualiflow-select-all" style="font-weight:600;font-size:0.9rem;cursor:pointer">Selecionar Todos</label>
        <span id="qualiflow-selection-count" class="qualiflow-selection-count">${scenarios.length}/${scenarios.length} selecionados</span>
        `;
    list.appendChild(selHeader);
    selHeader.querySelector('#qualiflow-select-all').addEventListener('change', onSelectAllToggle);

    scenarios.forEach((sc, idx) => {
        const itemEl = document.createElement('div');
        itemEl.className = 'qualiflow-acc-item';

        const header = document.createElement('div');
        header.className = 'qualiflow-acc-header';

        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.className = 'qualiflow-chk scenario-check';
        chk.checked = true;
        chk.dataset.idx = idx;
        chk.addEventListener('change', updateSelectionCount);

        const title = document.createElement('span');
        title.className = 'qualiflow-acc-title';
        title.textContent = sc.title + (sc.id_original ? ` [ID ${sc.id_original}]` : ' [Novo]');

        const paramFlag = document.createElement('span');
        paramFlag.className = 'qualiflow-param-indicator qualiflow-hidden';
        paramFlag.innerHTML = '⚠️';
        paramFlag.title = 'Contém @parâmetros não preenchidos';

        const caret = document.createElement('span');
        caret.className = 'qualiflow-caret';
        caret.innerHTML = '▼';

        header.appendChild(chk);
        header.appendChild(title);
        header.appendChild(paramFlag);
        header.appendChild(caret);

        // Param Check Logic
        const checkParams = () => {
            const hasParams = /@\w+/.test(sc.bdd_description) || sc.steps.some(st => /@\w+/.test(st.action) || /@\w+/.test(st.expected));
            const allFilled = sc.parameters && Object.keys(sc.parameters).length > 0 && Object.values(sc.parameters).every(v => v && v.trim() !== "");
            if (hasParams && !allFilled) {
                paramFlag.classList.remove('qualiflow-hidden');
            } else {
                paramFlag.classList.add('qualiflow-hidden');
            }
        };
        checkParams();
        itemEl.checkParams = checkParams;

        const body = document.createElement('div');
        body.className = 'qualiflow-acc-body qualiflow-hidden';

        const esc = (text) => (text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

        const renderViewAndEdit = () => {
            const stepsTableHTML = sc.steps.map(st => {
                const icon = st.needs_evidence ? ' 📸' : '';
                return `<tr><td>${icon}${esc(st.action)}</td><td>${esc(st.expected)}</td></tr>`;
            }).join('');

            body.innerHTML = `
            <div class="qualiflow-modes-container">
                <div class="qualiflow-view-mode">
                    <button class="qualiflow-btn-inline qualiflow-btn-secondary qualiflow-edit-btn" data-idx="${idx}" style="float: right; margin-bottom: 8px;"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="vertical-align:text-bottom;margin-right:2px"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.89 1.112l-2.83.94c-.407.136-.78-.238-.645-.645l.94-2.83a4.5 4.5 0 011.112-1.89l13.34-13.34z"></path></svg> Editar Cenário</button>
                    <h4 class="qualiflow-view-title" style="margin-top: 0; padding-top: 4px;">${esc(sc.title)}</h4>
                    <p class="qualiflow-view-bdd">${esc(sc.bdd_description).replace(/(\\n|\n|\r\n)/g, '<br/>')}</p>
                    <table class="qualiflow-steps-table">
                        <thead><tr><th>Ação (📸 => Evidência)</th><th>Esperado</th></tr></thead>
                        <tbody>${stepsTableHTML}</tbody>
                    </table>
                </div>
            </div>
            `;

            body.querySelector('.qualiflow-edit-btn').addEventListener('click', () => {
                openEditModal(idx);
            });
        };

        renderViewAndEdit();
        // Keep a reference to re-render later if edit changes it
        itemEl.renderViewAndEdit = renderViewAndEdit;

        header.addEventListener('click', (e) => {
            if (e.target.tagName.toLowerCase() === 'input' || e.target.tagName.toLowerCase() === 'button' || e.target.closest('button')) return;
            body.classList.toggle('qualiflow-hidden');
            caret.innerHTML = body.classList.contains('qualiflow-hidden') ? '▼' : '▲';
        });

        itemEl.appendChild(header);
        itemEl.appendChild(body);
        list.appendChild(itemEl);
    });
}
function closeEditModal() {
    document.getElementById('qualiflow-edit-modal-overlay').classList.add('qualiflow-hidden');
}
function openEditModal(idx) {
    const sc = currentScenarios[idx];
    const overlay = document.getElementById('qualiflow-edit-modal-overlay');
    const body = document.getElementById('qualiflow-edit-body');
    const esc = (text) => (text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const scTags = currentWorkItemData.tags || "";
    const scAssignee = sc.assignedTo?.trim() || "";

    body.innerHTML = `
        <div class="qualiflow-form-group">
            <label>Título:</label>
            <input type="text" id="edit-modal-title" value="${esc(sc.title)}" class="qualiflow-input-edit" />
        </div>
        <div class="qualiflow-step-row">
            <div class="qualiflow-form-group" style="flex:1">
                <label>Tags do PBI (herdadas automaticamente):</label>
                <input type="text" id="edit-modal-tags" value="${esc(scTags)}" class="qualiflow-input-edit" placeholder="Tags herdadas do PBI" readonly />
            </div>
            <div class="qualiflow-form-group" style="flex:1">
                <label>Responsável (opcional):</label>
                <input type="text" id="edit-modal-assignee" value="${esc(scAssignee)}" class="qualiflow-input-edit" placeholder="nome@empresa.com ou DOMÍNIO\\usuario" />
            </div>
        </div>
        <div class="qualiflow-form-group">
            <label>Contexto BDD (Dado / Quando / Então):</label>
            <textarea id="edit-modal-bdd" class="qualiflow-textarea-edit">${esc(sc.bdd_description)}</textarea>
        </div>
        <div class="qualiflow-form-group">
            <div style="display:flex; justify-content:space-between; align-items:flex-end;">
                <label>Passos de Execução:</label>
                <button type="button" id="edit-modal-add-step" class="qualiflow-btn-inline qualiflow-btn-secondary" style="padding:4px 8px; font-size:0.75rem;">+ Adicionar Passo</button>
            </div>
            <div id="edit-modal-steps-container" style="margin-top:8px;"></div>
        </div>
 
        <div class="qualiflow-form-group" id="params-section">
            <label style="color:#f59e0b; font-weight:600;">Parâmetros (@data):</label>
            <div id="edit-modal-params-container"></div>
        </div>
        `;

    const stepsContainer = document.getElementById('edit-modal-steps-container');

    // Prefill assignee from scenario or QA email config (async)
    readLocalStorage(['qaEmail'], (stored) => {
        try {
            const assigneeInput = document.getElementById('edit-modal-assignee');
            if (!assigneeInput) return;
            if (sc.assignedTo && sc.assignedTo.trim()) {
                assigneeInput.value = sc.assignedTo.trim();
            } else if (stored.qaEmail && stored.qaEmail.trim()) {
                assigneeInput.value = stored.qaEmail.trim();
            }
        } catch (e) {
            console.warn('Erro ao preencher assignee na modal:', e);
        }
    });

    const createStepRow = (action, expected, needsEvid, stepIndex) => {
        const row = document.createElement('div');
        row.className = 'qualiflow-step-row';
        row.draggable = true;
        row.style.cursor = 'default';

        // drag handle
        const handle = document.createElement('span');
        handle.title = 'Arrastar para reordenar';
        handle.style.cssText = 'cursor:grab; color:#475569; padding:0 6px; font-size:1.1rem; user-select:none; align-self:center;';
        handle.textContent = '⋮⋮';
        handle.addEventListener('mousedown', () => { row.draggable = true; });

        const actEl = document.createElement('textarea');
        actEl.className = 'qualiflow-step-input step-act';
        actEl.rows = 2;
        actEl.placeholder = 'Ação';
        actEl.value = action;
        actEl.addEventListener('mousedown', () => { row.draggable = false; });

        const expEl = document.createElement('textarea');
        expEl.className = 'qualiflow-step-input step-exp';
        expEl.rows = 2;
        expEl.placeholder = 'Resultado Esperado';
        expEl.value = expected;
        expEl.addEventListener('mousedown', () => { row.draggable = false; });

        const evidBtn = document.createElement('button');
        evidBtn.className = `qualiflow-evidence-toggle ${needsEvid ? 'active' : ''}`;
        evidBtn.title = 'Requer Evidência';
        evidBtn.textContent = '📸';
        evidBtn.addEventListener('click', (e) => { e.currentTarget.classList.toggle('active'); });

        const delBtn = document.createElement('button');
        delBtn.className = 'qualiflow-btn-inline qualiflow-btn-secondary step-del';
        delBtn.style.padding = '8px';
        delBtn.title = 'Remover Passo';
        delBtn.innerHTML = '&times;';
        delBtn.addEventListener('click', () => row.remove());

        row.appendChild(handle);
        row.appendChild(actEl);
        row.appendChild(expEl);
        row.appendChild(evidBtn);
        row.appendChild(delBtn);

        // Drag-and-drop logic
        row.addEventListener('dragstart', (e) => {
            e.dataTransfer.effectAllowed = 'move';
            row.classList.add('dragging');
        });
        row.addEventListener('dragend', () => {
            row.classList.remove('dragging');
            stepsContainer.querySelectorAll('.qualiflow-step-row').forEach(r => r.classList.remove('drag-over'));
        });
        row.addEventListener('dragover', (e) => {
            e.preventDefault();
            const dragging = stepsContainer.querySelector('.dragging');
            if (!dragging || dragging === row) return;
            const rect = row.getBoundingClientRect();
            const mid = rect.top + rect.height / 2;
            stepsContainer.querySelectorAll('.qualiflow-step-row').forEach(r => r.classList.remove('drag-over'));
            row.classList.add('drag-over');
            if (e.clientY < mid) {
                stepsContainer.insertBefore(dragging, row);
            } else {
                stepsContainer.insertBefore(dragging, row.nextSibling);
            }
        });

        return row;
    };

    sc.steps.forEach((st, i) => {
        stepsContainer.appendChild(createStepRow(st.action, st.expected, st.needs_evidence, i));
    });

    document.getElementById('edit-modal-add-step').addEventListener('click', () => {
        stepsContainer.appendChild(createStepRow('', '', false, stepsContainer.children.length));
    });

    const saveBtn = document.getElementById('qualiflow-edit-save');
    saveBtn.onclick = () => {
        sc.title = document.getElementById('edit-modal-title').value;
        const enteredAssignee = document.getElementById('edit-modal-assignee').value.trim();
        sc.bdd_description = document.getElementById('edit-modal-bdd').value;

        const newSteps = [];
        stepsContainer.querySelectorAll('.qualiflow-step-row').forEach(row => {
            newSteps.push({
                action: row.querySelector('.step-act').value,
                expected: row.querySelector('.step-exp').value,
                needs_evidence: row.querySelector('.qualiflow-evidence-toggle').classList.contains('active')
            });
        });
        sc.steps = newSteps;

        // Parâmetros
        const paramInputs = document.querySelectorAll('.qualiflow-input-param');
        sc.parameters = {};
        paramInputs.forEach(inp => {
            sc.parameters[inp.dataset.pname] = inp.value;
        });

        const applyEditSave = (resolvedAssignee) => {
            if (resolvedAssignee) {
                sc.assignedTo = resolvedAssignee;
            } else {
                delete sc.assignedTo;
            }

            // Scope selector to the scenarios list to avoid being offset by local session cards
            const scenariosList = document.getElementById('qualiflow-scenarios-list');
            const allItems = scenariosList ? scenariosList.querySelectorAll('.qualiflow-acc-item') : document.querySelectorAll('.qualiflow-acc-item');
            const item = allItems[idx];
            if (!item) return;
            item.renderViewAndEdit();
            item.querySelector('.qualiflow-acc-title').textContent = sc.title + (sc.id_original ? ` [ID ${sc.id_original}]` : ' [Novo]');
            if (item.checkParams) item.checkParams();
            closeEditModal();
        };

        if (enteredAssignee) {
            applyEditSave(enteredAssignee);
        } else {
            readLocalStorage(['qaEmail'], (stored) => {
                if (stored.qaEmail?.trim()) {
                    applyEditSave(stored.qaEmail.trim());
                } else {
                    applyEditSave('');
                }
            });
        }
    };

    // Render Params Table Logic
    const renderParamsTable = () => {
        const pContainer = document.getElementById('edit-modal-params-container');
        ensureScenarioParamsDefault(sc);
        // Extract params from text
        const textToScan = sc.title + " " + sc.bdd_description + " " + sc.steps.map(s => s.action + " " + s.expected).join(" ");
        const foundParams = [...new Set(textToScan.match(/@\w+/g) || [])];

        if (foundParams.length === 0) {
            pContainer.innerHTML = '<p style="font-size:0.8rem; color:#64748b;">Nenhum parâmetro detectado automaticamente.</p>';
            return;
        }

        let tableHtml = `<table class="qualiflow-params-table"><thead><tr><th>Parâmetro</th><th>Valor Sugerido/Fixo</th></tr></thead><tbody>`;
        foundParams.forEach(pName => {
            const val = (sc.parameters && sc.parameters[pName]) || '###';
            sc.parameters = sc.parameters || {};
            if (!sc.parameters[pName] || sc.parameters[pName].trim() === '') {
                sc.parameters[pName] = '###';
            }
            tableHtml += `<tr>
                <td style="font-family:monospace; color:#f59e0b;">${pName}</td>
                <td><input type="text" class="qualiflow-input-param" data-pname="${pName}" value="${esc(sc.parameters[pName])}" placeholder="Ex: 'Admin', '1234'..." /></td>
            </tr>`;
        });
        tableHtml += `</tbody></table>`;
        pContainer.innerHTML = tableHtml;
    };
    renderParamsTable();


    overlay.classList.remove('qualiflow-hidden');
}
function onSaveScenarios() {
    const selectedIndices = Array.from(document.querySelectorAll('.scenario-check:checked')).map(el => parseInt(el.dataset.idx));

    if (selectedIndices.length === 0) {
        alert("Nenhum cenário selecionado.");
        return;
    }

    const finalScenarios = selectedIndices.map(idx => {
        const scenario = { ...currentScenarios[idx] };
        const assignee = scenario.assignedTo?.trim();
        if (!assignee || !/^([^\s@]+@[^\s@]+\.[^\s@]+|[^\\\s]+\\[^\\\s]+)$/.test(assignee)) {
            delete scenario.assignedTo;
        } else {
            scenario.assignedTo = assignee;
        }
        delete scenario.tags; // always use only parent work item tags
        ensureScenarioParamsDefault(scenario);
        return scenario;
    });
    const btn = document.getElementById('btn-save');
    const provider = detectBoardProvider();
    const providerLabel = provider === 'jira' ? 'Jira' : 'Azure';
    btn.disabled = true;
    btn.textContent = `Salvando no ${providerLabel}...`;

    // Strip existing_tests (large XML payloads) from parentData — not needed for save
    const parentDataClean = { ...currentWorkItemData };
    delete parentDataClean.existing_tests;

    sendRuntimeMessage({ action: "SAVE_SCENARIOS", scenarios: finalScenarios, parentData: parentDataClean, provider }, (response) => {
        btn.disabled = false;
        btn.textContent = 'Salvar no Board';

        if (response && (response.error || !response.success)) {
            let errorMsg = response.error || "Erro desconhecido ao salvar testes.";

            if (response.results && Array.isArray(response.results)) {
                const failed = response.results.filter(r => r.status === 'error');
                if (failed.length > 0) {
                    const detailed = failed.map(f => `- ${f.title}: ${f.error || 'Sem mensagem'} `).join('\n');
                    errorMsg += `\n\nDetalhes dos testes que falharam: \n${detailed} `;
                }
                const successCount = response.results.filter(r => r.status === 'success').length;
                const failCount = response.results.filter(r => r.status === 'error').length;
                if (response.partialSuccess) {
                    errorMsg = `⚠️ SUCESSO PARCIAL: ${successCount} teste(s) criado(s), ${failCount} falharam.\n\n${errorMsg} `;
                }
            }

            alert(errorMsg);
        } else {
            readLocalStorage(['qualiflowSavedSessions'], (res) => {
                const sessions = res.qualiflowSavedSessions || {};
                if (currentWorkItemData && sessions[currentWorkItemData.id]) {
                    delete sessions[currentWorkItemData.id];
                    writeLocalStorage({ qualiflowSavedSessions: sessions });
                }
            });

            const successCount = response.results.filter(r => r.status === 'success').length;
            alert(`✅ Sucesso! ${successCount} teste(s) criado(s) no ${providerLabel}.\n\nAtualizando página...`);
            closeModal();
            window.location.reload();
        }
    });
}

globalThis.onEvaluateCoverage = onEvaluateCoverage;
globalThis.onGenerateScenarios = onGenerateScenarios;
globalThis.startCopyFromCardFlow = startCopyFromCardFlow;
globalThis.onAutoAdjustCopiedScenarios = onAutoAdjustCopiedScenarios;
globalThis.syncCopyFlowButtons = syncCopyFlowButtons;
globalThis.renderLocalSessions = renderLocalSessions;
globalThis.onSaveLocal = onSaveLocal;
globalThis.closeEditModal = closeEditModal;
globalThis.onSaveScenarios = onSaveScenarios;
