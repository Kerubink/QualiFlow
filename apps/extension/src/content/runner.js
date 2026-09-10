/* runner.js - Injected by QualiFlow onto target URLs */
(function () {
    if (window.location.hostname.includes('dev.azure.com') || window.location.hostname.includes('visualstudio.com')) return;
    const bridge = window.qualiflowBridge;

    function readLocalStorage(keys, callback) {
        if (bridge && typeof bridge.getStorage === 'function') {
            bridge.getStorage(keys, callback);
            return;
        }
        chrome.storage.local.get(keys, callback);
    }

    function removeLocalStorage(keys, callback) {
        if (bridge && typeof bridge.removeStorage === 'function') {
            bridge.removeStorage(keys, callback);
            return;
        }
        chrome.storage.local.remove(keys, callback);
    }

    function sendRuntimeMessage(message, callback) {
        if (bridge && typeof bridge.sendRuntimeMessage === 'function') {
            bridge.sendRuntimeMessage(message, callback);
            return;
        }

        chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) {
                callback({ error: chrome.runtime.lastError.message });
                return;
            }
            callback(response);
        });
    }

    let activeSession = null;
    let runnerState = null; // { testCases: [], currentTcIndex: 0, runId: 0, results: [], stepResults: {} }

    readLocalStorage(['runnerProjects', 'runnerEnabled'], (data) => {
        if (data.runnerEnabled === false) {
            injectDisabledRunnerFAB();
            return;
        }
        const projects = data.runnerProjects || [];
        const currentUrl = window.location.href;
        const matchedProject = projects.find(p => currentUrl.startsWith(p.url));
        if (matchedProject) {
            injectMinimalRunnerFAB();
        }
    });

    function injectDisabledRunnerFAB() {
        if (document.getElementById('qualiflow-fab-container')) return;

        const fabContainer = document.createElement('div');
        fabContainer.id = 'qualiflow-fab-container';

        const mainFabIcon = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 3v18h18M18 17V9M13 17V5M8 17v-3"></path></svg>`;
        const runIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347c-.75.412-1.667-.13-1.667-.986V5.653z"></path></svg>`;

        fabContainer.innerHTML = `
          <div id="qualiflow-fab-run" class="qualiflow-fab-sub" title="Executar Testes (indisponível no momento)" style="translate: 0px -60px; opacity:.45; cursor:not-allowed;">
            ${runIcon}
          </div>
          <div id="qualiflow-fab-main" title="QualiFlow Tools">
                        ${mainFabIcon}
          </div>
        `;
        document.body.appendChild(fabContainer);
        document.getElementById('qualiflow-fab-run').addEventListener('click', () => {
            alert('Runner indisponível no momento.');
        });
    }

    // ─── FAB ────────────────────────────────────────────────────────────────

    function injectMinimalRunnerFAB() {
        if (document.getElementById('qualiflow-fab-container')) return;

        const fabContainer = document.createElement('div');
        fabContainer.id = 'qualiflow-fab-container';

        const mainFabIcon = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 3v18h18M18 17V9M13 17V5M8 17v-3"></path></svg>`;
        const runIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347c-.75.412-1.667-.13-1.667-.986V5.653z"></path></svg>`;

        fabContainer.innerHTML = `
          <div id="qualiflow-fab-run" class="qualiflow-fab-sub" title="Executar Testes" style="translate: 0px -60px;">
            ${runIcon}
          </div>
          <div id="qualiflow-fab-main" title="QualiFlow Tools">
                        ${mainFabIcon}
          </div>
        `;
        document.body.appendChild(fabContainer);
        document.getElementById('qualiflow-fab-run').addEventListener('click', openRunnerWindow);
    }

    // ─── WINDOW ─────────────────────────────────────────────────────────────

    function openRunnerWindow() {
        let w = document.getElementById('qualiflow-runner-window');
        if (!w) {
            w = document.createElement('div');
            w.id = 'qualiflow-runner-window';
            w.className = 'qualiflow-hidden';
            w.innerHTML = `
                <div id="qualiflow-runner-header" style="background:#1e293b; padding:10px 15px; cursor:move; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #334155; user-select:none;">
                    <div style="font-weight:600; color:#f8fafc; font-size:14px; display:flex; align-items:center;">
                        <svg width="16" height="16" fill="none" stroke="#6366f1" stroke-width="2" viewBox="0 0 24 24" style="margin-right:6px;"><path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347c-.75.412-1.667-.13-1.667-.986V5.653z"></path></svg>
                        QualiFlow Test Runner
                    </div>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span id="qualiflow-runner-minimize" title="Minimizar" style="cursor:pointer; color:#94a3b8; font-size:18px; line-height:1;">&minus;</span>
                        <span id="qualiflow-runner-close" title="Fechar" style="cursor:pointer; color:#94a3b8; font-size:18px; line-height:1;">&times;</span>
                    </div>
                </div>
                <div id="qualiflow-runner-body" style="padding:15px; color:#94a3b8; font-size:13px; flex:1; overflow-y:auto; background:#0f172a; position:relative;">
                    <div id="qualiflow-runner-session-info" style="margin-bottom:16px;"></div>
                    <div id="qualiflow-runner-content"></div>
                </div>
            `;
            document.body.appendChild(w);

            document.getElementById('qualiflow-runner-close').addEventListener('click', () => w.classList.add('qualiflow-hidden'));
            document.getElementById('qualiflow-runner-minimize').addEventListener('click', () => minimizeRunnerWindow(w));
            setupDrag(w, document.getElementById('qualiflow-runner-header'));

            w.style.right = '100px';
            w.style.bottom = '100px';
        }
        hideRunnerBubble();
        w.classList.remove('qualiflow-hidden');
        loadSession();
    }

    function minimizeRunnerWindow(w) {
        if (!w) return;
        const rect = w.getBoundingClientRect();
        const bubble = ensureRunnerBubble();

        bubble.style.left = `${Math.max(8, rect.left + rect.width - 56)}px`;
        bubble.style.top = `${Math.max(8, rect.top + rect.height - 56)}px`;
        bubble.style.right = 'auto';
        bubble.style.bottom = 'auto';
        bubble.classList.remove('qualiflow-hidden');

        w.classList.add('qualiflow-hidden');
    }

    function ensureRunnerBubble() {
        let bubble = document.getElementById('qualiflow-runner-bubble');
        if (bubble) return bubble;

        bubble = document.createElement('div');
        bubble.id = 'qualiflow-runner-bubble';
        bubble.className = 'qualiflow-hidden';
        bubble.title = 'Abrir Test Runner';
        bubble.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347c-.75.412-1.667-.13-1.667-.986V5.653z"></path></svg>`;
        document.body.appendChild(bubble);

        let moved = false;
        setupDrag(bubble, bubble, {
            onMove: () => { moved = true; },
            onEnd: () => {
                setTimeout(() => { moved = false; }, 0);
            }
        });

        bubble.addEventListener('click', () => {
            if (moved) return;
            openRunnerWindow();
        });

        return bubble;
    }

    function hideRunnerBubble() {
        const bubble = document.getElementById('qualiflow-runner-bubble');
        if (bubble) bubble.classList.add('qualiflow-hidden');
    }

    // ─── SESSION LOAD ────────────────────────────────────────────────────────

    function loadSession() {
        const sessionInfo = document.getElementById('qualiflow-runner-session-info');
        const content = document.getElementById('qualiflow-runner-content');

        sessionInfo.innerHTML = '<div style="color:#94a3b8; font-style:italic;">Verificando sessão...</div>';
        content.innerHTML = '';

        readLocalStorage(['runnerActiveSession'], (data) => {
            activeSession = data.runnerActiveSession;
            if (!activeSession || !activeSession.workItemId || (Date.now() - activeSession.timestamp > 2 * 60 * 60 * 1000)) {
                sessionInfo.innerHTML = `
                    <div style="background:#1e293b; border:1px solid #334155; border-radius:8px; padding:14px; text-align:center;">
                        <div style="font-size:24px; margin-bottom:8px;">🎯</div>
                        <div style="color:#e2e8f0; font-weight:600; margin-bottom:6px;">Nenhuma sessão ativa</div>
                        <div style="color:#64748b; font-size:12px;">Inicie o Run a partir do Azure Boards.</div>
                    </div>
                `;
                return;
            }

            sessionInfo.innerHTML = `
                <div style="background:#1e293b; border:1px solid #6366f1; border-radius:8px; padding:12px; margin-bottom:12px;">
                    <div style="font-size:10px; color:#6366f1; font-weight:700; text-transform:uppercase; margin-bottom:4px;">Sessão Ativa</div>
                    <div style="font-weight:600; color:#f8fafc; font-size:13px; margin-bottom:2px;">#${activeSession.workItemId} — ${activeSession.workItemTitle}</div>
                    <div style="margin-top:8px; display:flex; gap:6px;">
                        <button id="qualiflow-session-clear" style="font-size:11px; padding:4px 10px; background:transparent; border:1px solid #ef444480; color:#ef4444; border-radius:4px; cursor:pointer;">Encerrar Sessão</button>
                    </div>
                </div>
            `;
            document.getElementById('qualiflow-session-clear').addEventListener('click', endSession);

            if (runnerState && runnerState.runId) {
                // Resume ongoing run
                renderExecutionUI();
            } else {
                fetchTestCasesAndRender(content);
            }
        });
    }

    function endSession() {
        if (runnerState && runnerState.runId) {
            if (!confirm("Sessão em andamento. Ao encerrar, a execução no Azure (Test Run) ficará incompleta e precisará ser abortada manualmente. Deseja sair?")) return;
        }
        removeLocalStorage('runnerActiveSession', () => {
            activeSession = null;
            runnerState = null;
            loadSession();
        });
    }

    function fetchTestCasesAndRender(content) {
        content.innerHTML = '<div style="color:#94a3b8; font-style:italic;">Buscando Casos de Teste...</div>';
        sendRuntimeMessage({ action: 'GET_TEST_CASES_FOR_WORKITEM', workItemId: activeSession.workItemId }, (response) => {
            if (!response || response.error) {
                content.innerHTML = `<div style="color:#ef4444;">Erro ao buscar testes: ${response?.error}</div>`;
                return;
            }
            const tcs = response.data || [];
            if (tcs.length === 0) {
                content.innerHTML = '<div style="color:#94a3b8;">Nenhum teste encontrado.</div>';
                return;
            }
            renderTestCaseList(tcs, content);
        });
    }

    function renderTestCaseList(tcs, content) {
        let html = `<div style="font-weight:600; color:#e2e8f0; margin-bottom:10px;">Encontrados ${tcs.length} CTs vinculados:</div>`;
        html += tcs.map(tc => `
            <div style="background:#1e293b; border:1px solid #334155; border-radius:6px; padding:10px; margin-bottom:8px;">
                <div style="font-size:10px; color:#94a3b8; margin-bottom:3px; font-weight:600;">#${tc.id}</div>
                <div style="font-weight:600; color:#f8fafc; font-size:12px;">${tc.title}</div>
            </div>
        `).join('');

        html += `<button id="qualiflow-start-run-btn" style="width:100%; padding:10px; background:#6366f1; color:white; border:none; border-radius:6px; font-weight:600; cursor:pointer; margin-top:10px; display:flex; justify-content:center; align-items:center; gap:6px;">
            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 3l14 9-14 9V3z"></path></svg>
            Iniciar Execução Real (Test Run)
        </button>`;

        content.innerHTML = html;
        document.getElementById('qualiflow-start-run-btn').addEventListener('click', () => initializeTestRun(tcs));
    }

    // ─── EXECUTION INIT ───────────────────────────────────────────────────────

    function initializeTestRun(tcs) {
        const content = document.getElementById('qualiflow-runner-content');
        content.innerHTML = '<div style="color:#38bdf8; font-weight:600; text-align:center; padding:20px;">Preparando Test Run no Azure DevOps...<br><span style="font-size:11px; font-weight:400; color:#94a3b8;">Isso criará histórico real.</span></div>';

        const tcIds = tcs.map(t => t.id);
        sendRuntimeMessage({ action: 'GET_TEST_POINTS_FOR_TEST_CASES', testCaseIds: tcIds }, (ptResp) => {
            let pointIds = [];
            let planId = null;
            if (ptResp && !ptResp.error && ptResp.data && ptResp.data.length > 0) {
                pointIds = ptResp.data.map(p => p.pointId);
                planId = ptResp.data[0].planId;
            }

            const runTitle = `QualiFlow Ext Run - PBI ${activeSession.workItemId}`;

            sendRuntimeMessage({ action: 'CREATE_TEST_RUN', title: runTitle, planId, pointIds }, (runResp) => {
                if (!runResp || runResp.error) {
                    content.innerHTML = `<div style="color:#ef4444;">Erro ao criar Test Run: ${runResp?.error || ''}</div>`;
                    return;
                }

                const runId = runResp.runId;

                // If Ad-Hoc (no test points linked) we manually add the results to the Run
                if (pointIds.length === 0) {
                    sendRuntimeMessage({ action: 'ADD_ADHOC_RESULTS', runId, testCaseIds: tcIds }, (addResp) => {
                        if (!addResp || addResp.error) {
                            content.innerHTML = `<div style="color:#ef4444;">Erro ao inicializar Run ad-hoc: ${addResp?.error || ''}</div>`;
                            return;
                        }
                        finalizeRunInit(runId, tcs, addResp.data || []);
                    });
                } else {
                    sendRuntimeMessage({ action: 'GET_RUN_RESULTS', runId }, (resResp) => {
                        finalizeRunInit(runId, tcs, resResp.data || []);
                    });
                }
            });
        });
    }

    function finalizeRunInit(runId, tcs, resultsData) {
        console.log('[QualiFlow] finalizeRunInit resultsData:', JSON.stringify(resultsData));

        const mappedResults = resultsData.map((r, idx) => {
            let tcId = null;

            // 1. Try direct testCase id
            if (r.testCase?.id) {
                tcId = Number(r.testCase.id);
            }
            // 2. Try direct testCaseId
            else if (r.testCaseId) {
                tcId = Number(r.testCaseId);
            }
            // 3. Try parsing testCase.url (e.g. "/testCases/18329")
            else if (r.testCase?.url) {
                const parts = r.testCase.url.split('/');
                const last = parts[parts.length - 1];
                if (!isNaN(last)) tcId = Number(last);
            }
            // 4. Try parsing testCaseTitle if it contains the testcase ID (e.g. "Execução QualiFlow CT 18329")
            else if (r.testCaseTitle) {
                const match = r.testCaseTitle.match(/\b\d{5,}\b/); // looks for 5+ digit testcase ID
                if (match) tcId = Number(match[0]);
            }

            // 5. Fallback: match by index order if we have 1-to-1 alignment
            if (!tcId && tcs[idx]) {
                console.warn(`[QualiFlow] Falling back to index-based TC correlation for result ID ${r.id} -> TC ${tcs[idx].id}`);
                tcId = Number(tcs[idx].id);
            }

            return {
                resultId: r.id,
                testCaseId: tcId
            };
        });

        console.log('[QualiFlow] mappedResults:', JSON.stringify(mappedResults));

        runnerState = {
            testCases: tcs,
            currentTcIndex: 0,
            runId,
            results: mappedResults,
            stepResults: {},
            overallOutcomes: {},
            comments: {},
            commentVisible: {},
            evidences: {}   // key: `${tcId}` or `${tcId}_step_${stepIdx}`, value: [{name, dataUrl, type}]
        };
        renderExecutionUI();
    }

    // ─── EXECUTION UI ────────────────────────────────────────────────────────

    function renderExecutionUI() {
        const content = document.getElementById('qualiflow-runner-content');

        if (runnerState.currentTcIndex >= runnerState.testCases.length) {
            renderRunCompletedUI(content);
            return;
        }

        const tc = runnerState.testCases[runnerState.currentTcIndex];
        const progress = `${runnerState.currentTcIndex + 1} de ${runnerState.testCases.length}`;

        // Safely retrieve toggle/outcome states (with fallbacks for resumed sessions)
        if (!runnerState.overallOutcomes) runnerState.overallOutcomes = {};
        if (!runnerState.comments) runnerState.comments = {};
        if (!runnerState.commentVisible) runnerState.commentVisible = {};

        const overallOutcome = runnerState.overallOutcomes[tc.id] || 'None';
        const commentVisible = runnerState.commentVisible[tc.id] || false;
        const currentComment = runnerState.comments[tc.id] || '';

        const OUTCOME_OPTS = [
            { value: 'None', label: '— Resultado Geral —', color: '#64748b' },
            { value: 'Passed', label: '✅ Passed', color: '#10b981' },
            { value: 'Failed', label: '❌ Failed', color: '#ef4444' },
            { value: 'Blocked', label: '🚫 Blocked', color: '#f59e0b' },
            { value: 'Paused', label: '⏸ Paused', color: '#6366f1' },
            { value: 'NotApplicable', label: '⊘ Not Applicable', color: '#94a3b8' },
        ];
        const selectedOpt = OUTCOME_OPTS.find(o => o.value === overallOutcome) || OUTCOME_OPTS[0];
        const selectColor = selectedOpt.color;
        const optionsHtml = OUTCOME_OPTS.map(o =>
            `<option value="${o.value}" ${o.value === overallOutcome ? 'selected' : ''}>${o.label}</option>`
        ).join('');

        const obsBg = commentVisible ? '#6366f1' : '#1e293b';
        const obsBorder = commentVisible ? '#6366f1' : '#475569';
        const obsText = commentVisible ? 'white' : '#cbd5e1';

        const ctEvidenceList = getEvidenceListFor(tc.id, null);
        const ctEvidenceBtn = buildEvidenceButtonHtml(ctEvidenceList, {
            id: 'qualiflow-evidence-btn',
            title: 'Evidências do CT (vários anexos permitidos)'
        });

        let html = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <span style="font-weight:600; color:#38bdf8; font-size:12px;">Em Execução</span>
                <span style="background:#334155; padding:2px 6px; border-radius:4px; font-size:10px; color:#e2e8f0;">${progress}</span>
            </div>
            
            <div style="background:#1e293b; border:1px solid #6366f1; border-radius:8px; padding:12px; margin-bottom:12px; position:relative; overflow:hidden;">
                <div style="position:absolute; top:0; left:0; width:4px; height:100%; background:#6366f1;"></div>
                <div style="font-size:10px; color:#94a3b8; margin-bottom:2px; font-weight:600;">CT #${tc.id}</div>
                <div style="font-weight:600; color:#f8fafc; font-size:14px; line-height:1.4;">${sanitize(tc.title)}</div>
                <div id="qualiflow-ct-evidence-strip" style="margin-top:8px;">${buildEvidenceStripHtml(ctEvidenceList, 'CT')}</div>
            </div>

            <!-- Top Actions & Selector bar -->
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; border-bottom:1px solid #334155; padding-bottom:12px; gap:8px;">
                <div style="flex:1;">
                    <select id="qualiflow-overall-outcome" style="width:100%; background:#0f172a; border:1px solid ${selectColor}60; color:${selectColor}; border-radius:4px; padding:6px 8px; font-size:11px; font-weight:600; cursor:pointer; outline:none; font-family:inherit;">
                        ${optionsHtml}
                    </select>
                </div>
                
                <div style="display:flex; gap:6px;">
                    <button id="qualiflow-toggle-comment" style="padding:6px 8px; background:${obsBg}; border:1px solid ${obsBorder}; color:${obsText}; border-radius:4px; cursor:pointer; font-size:11px; display:flex; align-items:center; gap:3px; font-weight:600; transition:all 0.15s;" title="Adicionar Comentário Geral">
                        💬 Obs
                    </button>
                    ${ctEvidenceBtn}
                    <button id="qualiflow-save-tc" style="padding:6px 12px; background:#10b981; color:white; border:none; border-radius:4px; font-weight:600; cursor:pointer; font-size:11px; transition:all 0.15s;">
                        Salvar
                    </button>
                </div>
            </div>

            <!-- Toggleable Comment Box -->
            <div id="qualiflow-comment-block" style="display:${commentVisible ? 'block' : 'none'}; margin-bottom:15px;">
                <textarea id="qualiflow-overall-comment" placeholder="Escreva o comentário geral da execução..." style="width:100%; box-sizing:border-box; background:#0f172a; border:1px solid #6366f140; border-radius:6px; color:#e2e8f0; padding:8px; font-size:11px; resize:vertical; min-height:45px; font-family:inherit;">${currentComment}</textarea>
            </div>

            <div id="qualiflow-step-container"></div>
        `;

        content.innerHTML = html;
        renderStepsForExecution(tc);

        // Bind events for top selectors and controllers
        document.getElementById('qualiflow-overall-outcome').addEventListener('change', (e) => {
            runnerState.overallOutcomes[tc.id] = e.target.value;
            // Re-style the border/color without a full re-render for UX smoothness
            const COLORS = { None: '#64748b', Passed: '#10b981', Failed: '#ef4444', Blocked: '#f59e0b', Paused: '#6366f1', NotApplicable: '#94a3b8' };
            const sel = e.target;
            sel.style.borderColor = (COLORS[e.target.value] || '#475569') + '60';
            sel.style.color = COLORS[e.target.value] || '#94a3b8';
        });

        document.getElementById('qualiflow-evidence-btn').addEventListener('click', () => {
            const textarea = document.getElementById('qualiflow-overall-comment');
            if (textarea) runnerState.comments[tc.id] = textarea.value;
            openEvidencePanel(tc, null);
        });

        document.getElementById('qualiflow-toggle-comment').addEventListener('click', () => {
            // Keep comment before re-rendering
            const textarea = document.getElementById('qualiflow-overall-comment');
            if (textarea) runnerState.comments[tc.id] = textarea.value;

            runnerState.commentVisible[tc.id] = !runnerState.commentVisible[tc.id];
            renderExecutionUI();
        });

        document.getElementById('qualiflow-save-tc').addEventListener('click', () => {
            // Save comment state
            const textarea = document.getElementById('qualiflow-overall-comment');
            if (textarea) runnerState.comments[tc.id] = textarea.value;

            // Also capture the select's current value (user may have changed it without triggering change)
            const selectEl = document.getElementById('qualiflow-overall-outcome');
            if (selectEl && selectEl.value !== 'None') runnerState.overallOutcomes[tc.id] = selectEl.value;

            let finalOutcome = runnerState.overallOutcomes[tc.id] || 'None';
            if (finalOutcome === 'None') {
                const hasFailed = (runnerState.stepResults[tc.id] || []).some(s => s.outcome === 'Failed');
                finalOutcome = hasFailed ? 'Failed' : 'Passed';
            }
            finishCurrentTestCase(finalOutcome);
        });
    }

    function renderStepsForExecution(tc) {
        const container = document.getElementById('qualiflow-step-container');
        if (!tc.steps || tc.steps.length === 0) {
            container.innerHTML = '<div style="color:#94a3b8; font-style:italic; font-size:12px;">Sem steps descritos. Avalie e conclua abaixo.</div>';
            return;
        }

        // Initialize state for steps if not present
        if (!runnerState.stepResults[tc.id]) {
            runnerState.stepResults[tc.id] = tc.steps.map(s => ({ stepId: s.stepId || s.order, outcome: 'None', comment: '' }));
        }

        let stepsHtml = tc.steps.map((s, idx) => {
            const res = runnerState.stepResults[tc.id][idx];
            const passBg = res.outcome === 'Passed' ? '#10b981' : '#1e293b';
            const failBg = res.outcome === 'Failed' ? '#ef4444' : '#1e293b';
            const stepEvs = getEvidenceListFor(tc.id, idx);
            const stepEvBtn = buildEvidenceButtonHtml(stepEvs, {
                className: 'step-evidence-btn',
                dataIdx: idx,
                title: `Evidências do passo ${s.order} (vários anexos permitidos)`
            });

            return `
            <div class="qualiflow-exec-step" data-step-idx="${idx}" style="background:#1e293b; border:1px solid #334155; border-radius:6px; padding:10px; margin-bottom:8px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
                    <div style="min-width:20px; height:20px; border-radius:50%; background:#334155; color:#94a3b8; font-size:10px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0;">${s.order}</div>
                    <div style="flex:1; min-width:0;">
                        <div style="font-size:12px; color:#e2e8f0; margin-bottom:4px;">${sanitize(s.action)}</div>
                        ${s.expected ? `<div style="font-size:11px; color:#6366f1; padding:4px; background:#6366f110; border-left:2px solid #6366f1;">Exp: ${sanitize(s.expected)}</div>` : ''}
                        <div class="step-evidence-strip" data-idx="${idx}" style="margin-top:6px;">${buildEvidenceStripHtml(stepEvs, `Passo ${s.order}`)}</div>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:4px; flex-shrink:0;">
                         <button class="step-btn pass-btn" data-idx="${idx}" style="padding:4px 8px; border:none; border-radius:4px; background:${passBg}; color:white; cursor:pointer; font-size:10px;">&#x2705; Pass</button>
                         <button class="step-btn fail-btn" data-idx="${idx}" style="padding:4px 8px; border:none; border-radius:4px; background:${failBg}; color:white; cursor:pointer; font-size:10px;">&#x274C; Fail</button>
                         ${stepEvBtn}
                    </div>
                </div>
                ${res.outcome === 'Failed' ? `
                    <div style="margin-top:10px; padding-top:10px; border-top:1px dashed #334155;">
                        <textarea class="step-comment" data-idx="${idx}" placeholder="O que falhou no passo?" style="width:100%; box-sizing:border-box; background:#0f172a; border:1px solid #ef444480; color:#e2e8f0; border-radius:4px; padding:6px; font-size:11px; margin-bottom:6px; resize:vertical;">${res.comment || ''}</textarea>
                        <button class="step-bug-btn" data-idx="${idx}" style="font-size:10px; background:transparent; border:1px solid #ef4444; color:#ef4444; padding:4px 8px; border-radius:4px; cursor:pointer;">&#x1F41B; Criar Bug</button>
                    </div>
                ` : ''}
            </div>
        `}).join('');

        container.innerHTML = stepsHtml;

        // Attach listeners
        container.querySelectorAll('.step-btn.pass-btn').forEach(b => {
            b.addEventListener('click', (e) => {
                const idx = e.target.getAttribute('data-idx');
                runnerState.stepResults[tc.id][idx].outcome = 'Passed';
                renderStepsForExecution(tc); // poor man's react
            });
        });
        container.querySelectorAll('.step-btn.fail-btn').forEach(b => {
            b.addEventListener('click', (e) => {
                const idx = e.target.getAttribute('data-idx');
                runnerState.stepResults[tc.id][idx].outcome = 'Failed';
                renderStepsForExecution(tc);
            });
        });
        container.querySelectorAll('.step-comment').forEach(i => {
            i.addEventListener('input', (e) => {
                const idx = e.target.getAttribute('data-idx');
                runnerState.stepResults[tc.id][idx].comment = e.target.value;
            });
        });
        container.querySelectorAll('.step-bug-btn').forEach(b => {
            b.addEventListener('click', (e) => {
                const idx = e.target.getAttribute('data-idx');
                const comment = runnerState.stepResults[tc.id][idx].comment || 'Falha no passo ' + tc.steps[idx].order;
                createBugForStep(tc, idx, comment);
            });
        });
        container.querySelectorAll('.step-evidence-btn').forEach(b => {
            b.addEventListener('click', (e) => {
                const btn = e.target.closest('.step-evidence-btn') || e.target;
                const idx = parseInt(btn.getAttribute('data-idx'));
                openEvidencePanel(tc, idx);
            });
        });
    }

    function createBugForStep(tc, stepIdx, comment) {
        const step = tc.steps[stepIdx];
        const content = document.getElementById('qualiflow-runner-content');
        const overlay = document.createElement('div');
        overlay.style.cssText = "position:absolute; top:0;left:0;right:0;bottom:0; background:rgba(15,23,42,0.8); display:flex; align-items:center; justify-content:center; z-index:10;";
        overlay.innerHTML = '<div style="background:#1e293b; padding:15px; border-radius:8px; color:#f8fafc; font-size:12px; font-weight:600;">Criando Bug no Azure...</div>';
        content.appendChild(overlay);

        const bugTitle = `[BUG] Falha na execução do CT ${tc.id}: Passo ${step.order}`;
        const bugComment = `**Passo:** ${sanitize(step.action)}\n**Esperado:** ${sanitize(step.expected)}\n\n**O que aconteceu:**\n${comment}`;

        sendRuntimeMessage({
            action: 'CREATE_BUG',
            title: bugTitle,
            comment: bugComment,
            testCaseId: tc.id,
            workItemId: activeSession.workItemId
        }, (res) => {
            content.removeChild(overlay);
            if (res && res.bugId) {
                alert(`Bug #${res.bugId} criado e associado ao PBI!`);
            } else {
                alert(`Erro ao criar bug: ${res?.error}`);
            }
        });
    }

    // ─── EXECUTION COMPLETION ────────────────────────────────────────────────

    function finishCurrentTestCase(outcome) {
        const tc = runnerState.testCases[runnerState.currentTcIndex];
        const tcResultMeta = runnerState.results.find(r => Number(r.testCaseId) === Number(tc.id));
        // Comment may live in the visible textarea OR in saved state (when box is collapsed)
        const liveTextarea = document.getElementById('qualiflow-overall-comment');
        const comment = (liveTextarea ? liveTextarea.value : (runnerState.comments[tc.id] || '')).trim();
        // Persist in state for safety
        if (!runnerState.comments) runnerState.comments = {};
        runnerState.comments[tc.id] = comment;
        const stepResults = runnerState.stepResults[tc.id] || [];

        if (!tcResultMeta) {
            alert(`Erro: Não foi possível correlacionar o Caso de Teste #${tc.id} com nenhuma das execuções iniciadas no Azure.`);
            renderExecutionUI();
            return;
        }

        // Check if user clicked 'Passed' but there are steps marked 'Failed'
        const hasFailedStep = stepResults.some(s => s.outcome === 'Failed');
        if (outcome === 'Passed' && hasFailedStep) {
            if (!confirm("Existem passos marcados como FALHA. Deseja realmente concluir o CT como APROVADO?")) return;
        }

        // Auto-mark remaining None steps as passed/failed based on outcome
        stepResults.forEach(s => {
            if (s.outcome === 'None') s.outcome = outcome; // propagate outcome to untouched steps
        });

        const content = document.getElementById('qualiflow-runner-content');
        content.innerHTML = '<div style="color:#10b981; font-weight:600; text-align:center; padding:20px;"><div style="font-size:20px; margin-bottom:10px;">💾</div>Salvando resultado no Azure...</div>';

        sendRuntimeMessage({
            action: 'UPDATE_TEST_RESULT',
            runId: runnerState.runId,
            resultId: tcResultMeta.resultId,
            outcome,
            comment,
            stepResults
        }, (res) => {
            if (!res || res.error) {
                alert("Erro ao salvar resultado: " + (res?.error || "Resposta vazia"));
                renderExecutionUI();
            } else {
                runnerState.currentTcIndex++;
                renderExecutionUI();
            }
        });
    }

    function renderRunCompletedUI(content) {
        content.innerHTML = `
            <div style="text-align:center; padding:20px;">
                <div style="font-size:32px; margin-bottom:15px;">🏁</div>
                <div style="font-weight:700; color:#f8fafc; font-size:16px; margin-bottom:8px;">Execução Finalizada!</div>
                <div style="color:#94a3b8; font-size:12px; margin-bottom:20px;">Todos os testes vinculados a este PBI foram avaliados. Vamos encerrar e registrar no Azure.</div>
                
                <button id="qualiflow-complete-run-btn" style="width:100%; padding:12px; background:#10b981; color:white; border:none; border-radius:6px; font-weight:600; cursor:pointer;">
                    Encerrar Sessão e Fechar Run
                </button>
            </div>
        `;

        document.getElementById('qualiflow-complete-run-btn').addEventListener('click', () => {
            content.innerHTML = '<div style="color:#10b981; text-align:center; padding:20px;">Concluindo histórico no servidor...</div>';
            sendRuntimeMessage({ action: 'COMPLETE_TEST_RUN', runId: runnerState.runId, state: 'Completed' }, (res) => {
                if (!res || res.error) {
                    alert("Erro ao concluir Test Run: " + res?.error);
                }

                removeLocalStorage('runnerActiveSession', () => {
                    activeSession = null;
                    runnerState = null;
                    loadSession();
                });
            });
        });
    }

    // ─── EVIDENCE (SCREENSHOT / RECORDING) ──────────────────────────────────

    let _mediaRecorder = null;
    let _recordingChunks = [];
    let _recordingTimer = null;
    let _recordingSeconds = 0;

    function getEvidenceListFor(tcId, stepIdx) {
        if (!runnerState?.evidences) return [];
        const key = stepIdx !== null && stepIdx !== undefined
            ? `${tcId}_step_${stepIdx}`
            : String(tcId);
        return runnerState.evidences[key] || [];
    }

    function summarizeEvidence(list) {
        const total = list.length;
        const uploaded = list.filter(e => e.status === 'uploaded').length;
        const errors = list.filter(e => e.status === 'error').length;
        const pending = list.filter(e => e.status === 'uploading' || e.status === 'pending').length;
        return { total, uploaded, errors, pending };
    }

    function shortEvidenceName(name) {
        if (!name) return 'anexo';
        if (name.length <= 28) return name;
        const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')) : '';
        return name.slice(0, 18) + '…' + ext;
    }

    function buildEvidenceButtonHtml(list, opts = {}) {
        const sum = summarizeEvidence(list);
        const hasAny = sum.total > 0;
        const hasUploaded = sum.uploaded > 0;
        const hasError = sum.errors > 0;
        const border = hasError ? '#ef444480' : hasUploaded ? '#10b98180' : hasAny ? '#f59e0b60' : '#47556980';
        const bg = hasError ? '#ef444415' : hasUploaded ? '#10b98118' : hasAny ? '#f59e0b12' : '#1e293b';
        const color = hasError ? '#fca5a5' : hasUploaded ? '#6ee7b7' : hasAny ? '#fcd34d' : '#cbd5e1';
        const idAttr = opts.id ? `id="${opts.id}"` : '';
        const classAttr = opts.className ? `class="${opts.className}"` : '';
        const dataAttr = opts.dataIdx !== undefined && opts.dataIdx !== null ? `data-idx="${opts.dataIdx}"` : '';
        const title = opts.title || 'Evidências';
        const countLabel = hasAny ? String(sum.total) : '';
        const mark = hasUploaded ? '✅' : hasError ? '❌' : hasAny ? '⏳' : '📸';
        return `<button ${idAttr} ${classAttr} ${dataAttr} style="padding:6px 8px; background:${bg}; border:1px solid ${border}; color:${color}; border-radius:4px; cursor:pointer; font-size:11px; display:flex; align-items:center; gap:4px; font-weight:600; transition:all 0.15s;" title="${title}">
            ${mark}${countLabel ? ` <span style="background:${hasUploaded ? '#10b981' : hasError ? '#ef4444' : '#f59e0b'};color:#0f172a;border-radius:999px;padding:0 5px;font-size:10px;line-height:16px;min-width:16px;text-align:center;">${countLabel}</span>` : ''}
        </button>`;
    }

    function buildEvidenceStripHtml(list, scopeLabel) {
        if (!list || list.length === 0) return '';
        const sum = summarizeEvidence(list);
        const chips = list.map((ev, i) => {
            const icon = ev.type === 'video/webm' ? '🎬' : '🖼️';
            const st = ev.status === 'uploaded' ? '✅' : ev.status === 'error' ? '❌' : '⏳';
            const border = ev.status === 'uploaded' ? '#10b98150' : ev.status === 'error' ? '#ef444450' : '#f59e0b50';
            const safeTitle = String(ev.name || '').replace(/"/g, '&quot;');
            return `<span title="${safeTitle}" style="display:inline-flex;align-items:center;gap:3px;padding:2px 7px;border-radius:999px;border:1px solid ${border};background:#0f172a;font-size:10px;color:#cbd5e1;max-width:100%;">
                <span>${icon}${st}</span>
                <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:140px;">${shortEvidenceName(ev.name)}</span>
                <span style="color:#475569;">#${i + 1}</span>
            </span>`;
        }).join('');
        return `
          <div style="padding:6px 8px;background:#0f172a;border:1px solid #334155;border-radius:6px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;gap:6px;">
              <span style="font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.03em;">📎 Anexos · ${scopeLabel}</span>
              <span style="font-size:10px;color:#64748b;">${sum.uploaded}/${sum.total} no Azure${sum.errors ? ` · ${sum.errors} erro(s)` : ''}${sum.pending ? ` · ${sum.pending} enviando` : ''}</span>
            </div>
            <div style="display:flex;flex-wrap:wrap;gap:4px;">${chips}</div>
          </div>`;
    }

    /** Refresh CT/step badges + strips without full re-render (keeps outcome/comment state). */
    function refreshEvidenceIndicators(tc) {
        if (!tc || !runnerState) return;

        const ctList = getEvidenceListFor(tc.id, null);
        const ctBtn = document.getElementById('qualiflow-evidence-btn');
        if (ctBtn) {
            const tmp = document.createElement('div');
            tmp.innerHTML = buildEvidenceButtonHtml(ctList, {
                id: 'qualiflow-evidence-btn',
                title: 'Evidências do CT (vários anexos permitidos)'
            });
            const next = tmp.firstElementChild;
            // preserve click by rebinding after replace
            ctBtn.replaceWith(next);
            next.addEventListener('click', () => {
                const textarea = document.getElementById('qualiflow-overall-comment');
                if (textarea) runnerState.comments[tc.id] = textarea.value;
                openEvidencePanel(tc, null);
            });
        }

        const ctStrip = document.getElementById('qualiflow-ct-evidence-strip');
        if (ctStrip) ctStrip.innerHTML = buildEvidenceStripHtml(ctList, 'CT');

        (tc.steps || []).forEach((s, idx) => {
            const list = getEvidenceListFor(tc.id, idx);
            const stepBtn = document.querySelector(`.step-evidence-btn[data-idx="${idx}"]`);
            if (stepBtn) {
                const tmp = document.createElement('div');
                tmp.innerHTML = buildEvidenceButtonHtml(list, {
                    className: 'step-evidence-btn',
                    dataIdx: idx,
                    title: `Evidências do passo ${s.order} (vários anexos permitidos)`
                });
                const next = tmp.firstElementChild;
                stepBtn.replaceWith(next);
                next.addEventListener('click', (e) => {
                    const btn = e.target.closest('.step-evidence-btn') || e.target;
                    const i = parseInt(btn.getAttribute('data-idx'));
                    openEvidencePanel(tc, i);
                });
            }
            const strip = document.querySelector(`.step-evidence-strip[data-idx="${idx}"]`);
            if (strip) strip.innerHTML = buildEvidenceStripHtml(list, `Passo ${s.order}`);
        });
    }

    const QUALIFLOW_UI_HIDE_IDS = [
        'qualiflow-evidence-overlay',
        'qualiflow-runner-window',
        'qualiflow-runner-bubble',
        'qualiflow-fab-container',
        'qualiflow-rec-floating',
    ];

    /** Hide runner chrome so capture/recording does not include our overlays. */
    function hideQualiFlowUiForCapture(exceptIds = []) {
        const skip = new Set(exceptIds);
        QUALIFLOW_UI_HIDE_IDS.forEach((id) => {
            if (skip.has(id)) return;
            const el = document.getElementById(id);
            if (!el) return;
            el.style.setProperty('visibility', 'hidden', 'important');
            el.style.setProperty('pointer-events', 'none', 'important');
            el.style.setProperty('opacity', '0', 'important');
        });
    }

    function showQualiFlowUiAfterCapture() {
        QUALIFLOW_UI_HIDE_IDS.forEach((id) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.style.removeProperty('visibility');
            el.style.removeProperty('pointer-events');
            el.style.removeProperty('opacity');
        });
    }

    /** Wait for browser paint so captureVisibleTab does not include our UI. */
    function waitForUiHidden() {
        return new Promise((resolve) => {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    setTimeout(resolve, 100);
                });
            });
        });
    }

    function removeRecordingFloatingBar() {
        const bar = document.getElementById('qualiflow-rec-floating');
        if (bar) bar.remove();
    }

    function showRecordingFloatingBar(onStop) {
        removeRecordingFloatingBar();
        const bar = document.createElement('div');
        bar.id = 'qualiflow-rec-floating';
        bar.style.cssText = [
            'position:fixed',
            'bottom:20px',
            'left:50%',
            'transform:translateX(-50%)',
            'z-index:2147483646',
            'display:flex',
            'align-items:center',
            'gap:10px',
            'padding:8px 14px',
            'background:#0f172aee',
            'border:1px solid #ef444480',
            'border-radius:999px',
            'box-shadow:0 8px 24px #000a',
            'font-family:system-ui,sans-serif',
            'font-size:12px',
            'color:#f8fafc',
        ].join(';');
        bar.innerHTML = `
            <span id="qualiflow-rec-floating-timer" style="color:#ef4444;font-weight:700;min-width:70px;">⏺ 0s</span>
            <button id="qualiflow-rec-floating-stop" style="padding:5px 12px;background:#ef4444;color:white;border:none;border-radius:999px;font-weight:700;cursor:pointer;font-size:11px;">⏹ Parar</button>
        `;
        document.body.appendChild(bar);
        bar.querySelector('#qualiflow-rec-floating-stop').onclick = () => onStop();
        return bar;
    }

    function getEvidenceKey(tc, stepIdx) {
        return stepIdx !== null && stepIdx !== undefined ? `${tc.id}_step_${stepIdx}` : String(tc.id);
    }

    function getResultMetaForTc(tc) {
        if (!runnerState?.results) return null;
        return runnerState.results.find(r => Number(r.testCaseId) === Number(tc.id)) || null;
    }

    function buildEvidenceFileName(tc, stepIdx, kind, ext) {
        const stepPart = stepIdx !== null && stepIdx !== undefined
            ? `_passo${tc.steps[stepIdx]?.order ?? (stepIdx + 1)}`
            : '';
        return `ct${tc.id}${stepPart}_${kind}_${Date.now()}.${ext}`;
    }

    function dataUrlToBase64(dataUrl) {
        if (!dataUrl) return '';
        const comma = dataUrl.indexOf(',');
        return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
    }

    function blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(dataUrlToBase64(reader.result));
            reader.onerror = () => reject(reader.error || new Error('Falha ao ler blob'));
            reader.readAsDataURL(blob);
        });
    }

    /**
     * Upload evidence as Test Result attachment in Azure (execution-scoped).
     * Step-level evidence is tagged in the attachment comment (Azure attaches to result, not step).
     */
    async function uploadEvidenceToAzure(tc, stepIdx, evidence) {
        const meta = getResultMetaForTc(tc);
        if (!meta?.resultId) {
            return { error: `Não foi possível correlacionar o CT #${tc.id} com o resultado da execução no Azure.` };
        }
        if (!runnerState?.runId) {
            return { error: 'Sessão sem Test Run ativo.' };
        }

        let base64Content;
        try {
            if (evidence.blob) {
                base64Content = await blobToBase64(evidence.blob);
            } else {
                base64Content = dataUrlToBase64(evidence.dataUrl);
            }
        } catch (err) {
            return { error: 'Falha ao preparar arquivo: ' + (err.message || err) };
        }

        if (!base64Content) return { error: 'Arquivo de evidência vazio.' };

        const stepLabel = stepIdx !== null && stepIdx !== undefined
            ? `Passo ${tc.steps[stepIdx]?.order ?? (stepIdx + 1)}`
            : null;
        const comment = stepLabel
            ? `Evidência do ${stepLabel} — CT #${tc.id}`
            : `Evidência do CT #${tc.id}`;

        return new Promise((resolve) => {
            sendRuntimeMessage({
                action: 'ADD_ATTACHMENT',
                runId: runnerState.runId,
                resultId: meta.resultId,
                fileName: evidence.name,
                base64Content,
                comment
            }, (res) => {
                resolve(res || { error: 'Sem resposta do background.' });
            });
        });
    }

    async function addAndUploadEvidence(tc, stepIdx, list, key, evidence) {
        evidence.status = 'uploading';
        list.push(evidence);
        renderEvidenceList(list, key);
        refreshEvidenceIndicators(tc);

        const up = await uploadEvidenceToAzure(tc, stepIdx, evidence);
        if (up?.error) {
            evidence.status = 'error';
            evidence.error = up.error;
            renderEvidenceList(list, key);
            refreshEvidenceIndicators(tc);
            return false;
        }
        evidence.status = 'uploaded';
        evidence.azureId = up.result?.id;
        // Drop heavy local blob after successful upload to free memory
        if (evidence.blob) delete evidence.blob;
        renderEvidenceList(list, key);
        refreshEvidenceIndicators(tc);
        return true;
    }

    function openEvidencePanel(tc, stepIdx) {
        const key = getEvidenceKey(tc, stepIdx);
        if (!runnerState.evidences[key]) runnerState.evidences[key] = [];
        const list = runnerState.evidences[key];
        const label = stepIdx !== null && stepIdx !== undefined
            ? `Passo ${tc.steps[stepIdx]?.order ?? (stepIdx + 1)}`
            : `CT #${tc.id}`;

        // Build overlay
        const overlay = document.createElement('div');
        overlay.id = 'qualiflow-evidence-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(2,6,23,0.85);z-index:2147483640;display:flex;align-items:center;justify-content:center;';
        overlay.innerHTML = `
          <div style="background:#0f172a;border:1px solid #334155;border-radius:12px;width:480px;max-width:96vw;max-height:90vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 25px 60px #000a;">
            <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid #1e293b;flex-shrink:0;">
              <span style="font-weight:700;color:#f8fafc;font-size:13px;">📎 Evidências — ${label}</span>
              <button id="qe-close" style="background:transparent;border:none;color:#94a3b8;font-size:18px;cursor:pointer;line-height:1;">✕</button>
            </div>

            <div style="padding:8px 16px;border-bottom:1px solid #1e293b;font-size:10px;color:#64748b;flex-shrink:0;">
              Anexos da execução no Azure (Test Run). Não são salvos localmente.
            </div>

            <div style="display:flex;gap:8px;padding:12px 16px;border-bottom:1px solid #1e293b;flex-shrink:0;">
              <button id="qe-screenshot" style="flex:1;padding:8px;background:#6366f1;color:white;border:none;border-radius:6px;font-weight:600;cursor:pointer;font-size:12px;">📸 Capturar Tela</button>
              <button id="qe-record" style="flex:1;padding:8px;background:#1e293b;border:1px solid #334155;color:#cbd5e1;border-radius:6px;font-weight:600;cursor:pointer;font-size:12px;" data-recording="false">🔴 Gravar Tela</button>
            </div>

            <div id="qe-rec-status" style="display:none;background:#ef444420;border-bottom:1px solid #ef444440;padding:6px 16px;font-size:11px;color:#ef4444;font-weight:600;flex-shrink:0;"></div>

            <div id="qe-list" style="flex:1;overflow-y:auto;padding:12px 16px;display:flex;flex-direction:column;gap:8px;"></div>
          </div>
        `;

        document.body.appendChild(overlay);
        renderEvidenceList(list, key);

        overlay.querySelector('#qe-close').onclick = () => {
            if (_mediaRecorder && _mediaRecorder.state === 'recording') return; // keep open while recording
            overlay.remove();
        };
        overlay.onclick = (e) => {
            if (e.target === overlay && !(_mediaRecorder && _mediaRecorder.state === 'recording')) overlay.remove();
        };

        overlay.querySelector('#qe-screenshot').onclick = async () => {
            const btn = overlay.querySelector('#qe-screenshot');
            btn.disabled = true;
            btn.textContent = '⏳ Capturando...';

            // Hide evidence panel + runner so they do not appear in the screenshot
            hideQualiFlowUiForCapture();
            await waitForUiHidden();

            sendRuntimeMessage({ action: 'CAPTURE_SCREENSHOT' }, (res) => {
                btn.disabled = false;
                btn.innerHTML = '📸 Capturar Tela';

                if (res?.error) {
                    showQualiFlowUiAfterCapture();
                    alert('Erro: ' + res.error);
                    return;
                }

                // Keep UI hidden while annotation opens (fullscreen). Restore after save/cancel.
                openAnnotationPanel(res.dataUrl, async (annotated) => {
                    showQualiFlowUiAfterCapture();
                    if (!annotated) return;
                    const name = buildEvidenceFileName(tc, stepIdx, 'screenshot', 'png');
                    await addAndUploadEvidence(tc, stepIdx, list, key, {
                        name,
                        dataUrl: annotated,
                        type: 'image/png',
                        status: 'pending'
                    });
                });
            });
        };

        const recBtn = overlay.querySelector('#qe-record');
        const recStatus = overlay.querySelector('#qe-rec-status');

        const resetRecordUi = () => {
            recBtn.innerHTML = '🔴 Gravar Tela';
            recBtn.style.background = '#1e293b';
            recBtn.style.color = '#cbd5e1';
            recBtn.style.borderColor = '#334155';
            recStatus.style.display = 'none';
            clearInterval(_recordingTimer);
            removeRecordingFloatingBar();
            showQualiFlowUiAfterCapture();
        };

        const stopRecording = () => {
            if (_mediaRecorder && _mediaRecorder.state === 'recording') {
                _mediaRecorder.stop();
            }
            resetRecordUi();
        };

        recBtn.onclick = async () => {
            if (_mediaRecorder && _mediaRecorder.state === 'recording') {
                stopRecording();
                return;
            }

            try {
                // Browser picker first (UI still visible for the picker itself)
                const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });

                // Then hide runner chrome so the recording does not show our panels
                hideQualiFlowUiForCapture(['qualiflow-rec-floating']);
                await waitForUiHidden();

                _recordingChunks = [];
                _mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
                _mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) _recordingChunks.push(e.data); };
                _mediaRecorder.onstop = async () => {
                    stream.getTracks().forEach(t => t.stop());
                    const blob = new Blob(_recordingChunks, { type: 'video/webm' });
                    const url = URL.createObjectURL(blob);
                    const name = buildEvidenceFileName(tc, stepIdx, 'recording', 'webm');
                    await addAndUploadEvidence(tc, stepIdx, list, key, {
                        name,
                        dataUrl: url,
                        type: 'video/webm',
                        blob,
                        status: 'pending'
                    });
                };

                // If user stops sharing via browser chrome
                stream.getVideoTracks()[0]?.addEventListener('ended', () => {
                    if (_mediaRecorder && _mediaRecorder.state === 'recording') {
                        _mediaRecorder.stop();
                    }
                    resetRecordUi();
                });

                _mediaRecorder.start(100);
                _recordingSeconds = 0;
                recBtn.innerHTML = '⏹ Parar Gravação';
                recBtn.style.background = '#ef4444';
                recBtn.style.color = 'white';
                recBtn.style.borderColor = '#ef4444';

                const floating = showRecordingFloatingBar(stopRecording);
                const timerEl = floating.querySelector('#qualiflow-rec-floating-timer');
                _recordingTimer = setInterval(() => {
                    _recordingSeconds++;
                    if (timerEl) timerEl.textContent = `⏺ ${_recordingSeconds}s`;
                    recStatus.style.display = 'block';
                    recStatus.textContent = `⏺ Gravando... ${_recordingSeconds}s`;
                }, 1000);
            } catch (e) {
                showQualiFlowUiAfterCapture();
                alert('Não foi possível iniciar a gravação: ' + e.message);
            }
        };
    }

    function evidenceStatusHtml(ev) {
        if (ev.status === 'uploading' || ev.status === 'pending') {
            return '<span style="font-size:10px;color:#f59e0b;font-weight:600;">⏳ Enviando ao Azure...</span>';
        }
        if (ev.status === 'uploaded') {
            return '<span style="font-size:10px;color:#10b981;font-weight:600;">✅ Anexado à execução</span>';
        }
        if (ev.status === 'error') {
            return `<span style="font-size:10px;color:#ef4444;font-weight:600;" title="${(ev.error || '').replace(/"/g, '&quot;')}">❌ Falha no envio</span>`;
        }
        return '<span style="font-size:10px;color:#64748b;">—</span>';
    }

    function renderEvidenceList(list, key) {
        const container = document.getElementById('qe-list');
        if (!container) return;
        if (list.length === 0) {
            container.innerHTML = '<div style="color:#475569;font-size:12px;text-align:center;padding:20px 0;">Nenhuma evidência capturada ainda.</div>';
            return;
        }
        container.innerHTML = list.map((ev, i) => `
            <div style="background:#1e293b;border:1px solid #334155;border-radius:8px;overflow:hidden;">
              ${ev.type === 'video/webm'
                ? `<video src="${ev.dataUrl}" controls style="width:100%;max-height:160px;display:block;background:#000;"></video>`
                : `<img src="${ev.dataUrl}" style="width:100%;max-height:160px;object-fit:contain;display:block;background:#0f172a;" />`
            }
              <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;gap:8px;">
                <div style="min-width:0;flex:1;">
                  <div style="font-size:10px;color:#64748b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${ev.name}</div>
                  <div style="margin-top:2px;">${evidenceStatusHtml(ev)}</div>
                </div>
                <div style="display:flex;gap:6px;flex-shrink:0;">
                  ${ev.status === 'error' ? `<button class="qe-retry-btn" data-idx="${i}" style="font-size:10px;background:transparent;border:1px solid #f59e0b60;color:#f59e0b;padding:3px 7px;border-radius:4px;cursor:pointer;">Reenviar</button>` : ''}
                  <button class="qe-del-btn" data-idx="${i}" style="font-size:10px;background:transparent;border:1px solid #ef444440;color:#ef4444;padding:3px 7px;border-radius:4px;cursor:pointer;">Remover</button>
                </div>
              </div>
            </div>
        `).join('');

        container.querySelectorAll('.qe-del-btn').forEach(b => {
            b.onclick = () => {
                const idx = parseInt(b.getAttribute('data-idx'));
                list.splice(idx, 1);
                renderEvidenceList(list, key);
            };
        });

        container.querySelectorAll('.qe-retry-btn').forEach(b => {
            b.onclick = async () => {
                const idx = parseInt(b.getAttribute('data-idx'));
                const ev = list[idx];
                if (!ev) return;
                // Recover tc/step from key: "123" or "123_step_0"
                const m = String(key).match(/^(\d+)(?:_step_(\d+))?$/);
                if (!m || !runnerState) return;
                const tc = runnerState.testCases.find(t => Number(t.id) === Number(m[1]));
                if (!tc) return;
                const stepIdx = m[2] !== undefined ? Number(m[2]) : null;
                ev.status = 'uploading';
                ev.error = undefined;
                renderEvidenceList(list, key);
                const up = await uploadEvidenceToAzure(tc, stepIdx, ev);
                if (up?.error) {
                    ev.status = 'error';
                    ev.error = up.error;
                } else {
                    ev.status = 'uploaded';
                    ev.azureId = up.result?.id;
                    if (ev.blob) delete ev.blob;
                }
                renderEvidenceList(list, key);
            };
        });
    }

    function openAnnotationPanel(srcDataUrl, onSave) {
        const panel = document.createElement('div');
        panel.style.cssText = 'position:fixed;inset:0;background:#0a0f1a;z-index:2147483647;display:flex;flex-direction:column;';

        panel.innerHTML = `
          <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:#0f172a;border-bottom:1px solid #1e293b;flex-shrink:0;">
            <span style="font-weight:700;color:#f8fafc;font-size:12px;">✏️ Anotação</span>
            <div style="display:flex;gap:6px;margin-left:8px;">
              <button id="qa-tool-pen" style="padding:4px 10px;border-radius:4px;border:1px solid #6366f1;background:#6366f1;color:white;font-size:11px;cursor:pointer;font-weight:600;">Caneta</button>
              <button id="qa-tool-rect" style="padding:4px 10px;border-radius:4px;border:1px solid #334155;background:#1e293b;color:#cbd5e1;font-size:11px;cursor:pointer;">Retângulo</button>
              <button id="qa-tool-arrow" style="padding:4px 10px;border-radius:4px;border:1px solid #334155;background:#1e293b;color:#cbd5e1;font-size:11px;cursor:pointer;">Seta</button>
              <button id="qa-tool-text" style="padding:4px 10px;border-radius:4px;border:1px solid #334155;background:#1e293b;color:#cbd5e1;font-size:11px;cursor:pointer;">Texto</button>
            </div>
            <input id="qa-color" type="color" value="#ef4444" style="width:28px;height:28px;border:none;border-radius:4px;cursor:pointer;background:transparent;margin-left:4px;" title="Cor">
            <input id="qa-size" type="range" min="1" max="12" value="3" style="width:70px;accent-color:#6366f1;" title="Espessura">
            <button id="qa-undo" style="padding:4px 10px;border-radius:4px;border:1px solid #334155;background:#1e293b;color:#cbd5e1;font-size:11px;cursor:pointer;margin-left:4px;">↩ Desfazer</button>
            <div style="flex:1;"></div>
            <button id="qa-cancel" style="padding:4px 12px;border-radius:4px;border:1px solid #ef444440;background:transparent;color:#ef4444;font-size:11px;cursor:pointer;font-weight:600;">Cancelar</button>
            <button id="qa-save" style="padding:4px 14px;border-radius:4px;border:none;background:#10b981;color:white;font-size:11px;cursor:pointer;font-weight:700;">Salvar e anexar</button>
          </div>
          <div style="flex:1;display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative;">
            <canvas id="qa-canvas" style="max-width:100%;max-height:100%;object-fit:contain;cursor:crosshair;touch-action:none;"></canvas>
          </div>
        `;
        document.body.appendChild(panel);

        const canvas = panel.querySelector('#qa-canvas');
        // willReadFrequently: undo uses getImageData repeatedly
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const img = new Image();
        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
        };
        img.src = srcDataUrl;

        let tool = 'pen', color = '#ef4444', size = 3;
        let drawing = false, startX, startY;
        const history = [];

        const saveState = () => history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));

        const getPos = (e) => {
            const r = canvas.getBoundingClientRect();
            const scaleX = canvas.width / r.width;
            const scaleY = canvas.height / r.height;
            const src = e.touches ? e.touches[0] : e;
            return { x: (src.clientX - r.left) * scaleX, y: (src.clientY - r.top) * scaleY };
        };

        canvas.addEventListener('pointerdown', (e) => {
            drawing = true; saveState();
            const p = getPos(e); startX = p.x; startY = p.y;
            if (tool === 'pen') { ctx.beginPath(); ctx.moveTo(p.x, p.y); }
            if (tool === 'text') {
                const txt = prompt('Texto:');
                if (txt) { ctx.fillStyle = color; ctx.font = `${size * 6}px sans-serif`; ctx.fillText(txt, p.x, p.y); }
                drawing = false;
            }
        });

        canvas.addEventListener('pointermove', (e) => {
            if (!drawing) return;
            const p = getPos(e);
            if (tool === 'pen') {
                ctx.strokeStyle = color; ctx.lineWidth = size; ctx.lineCap = 'round';
                ctx.lineTo(p.x, p.y); ctx.stroke();
            }
        });

        const finishDraw = (e) => {
            if (!drawing) return; drawing = false;
            const p = getPos(e);
            ctx.strokeStyle = color; ctx.lineWidth = size;
            if (tool === 'rect') {
                ctx.strokeRect(startX, startY, p.x - startX, p.y - startY);
            } else if (tool === 'arrow') {
                ctx.beginPath(); ctx.moveTo(startX, startY); ctx.lineTo(p.x, p.y); ctx.stroke();
                // arrowhead
                const angle = Math.atan2(p.y - startY, p.x - startX);
                const len = 16;
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p.x - len * Math.cos(angle - 0.4), p.y - len * Math.sin(angle - 0.4));
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p.x - len * Math.cos(angle + 0.4), p.y - len * Math.sin(angle + 0.4));
                ctx.stroke();
            }
        };
        canvas.addEventListener('pointerup', finishDraw);
        canvas.addEventListener('pointerleave', finishDraw);

        // Tool buttons
        ['pen', 'rect', 'arrow', 'text'].forEach(t => {
            panel.querySelector(`#qa-tool-${t}`).onclick = () => {
                tool = t;
                ['pen', 'rect', 'arrow', 'text'].forEach(x => {
                    const btn = panel.querySelector(`#qa-tool-${x}`);
                    btn.style.background = x === t ? '#6366f1' : '#1e293b';
                    btn.style.borderColor = x === t ? '#6366f1' : '#334155';
                    btn.style.color = x === t ? 'white' : '#cbd5e1';
                });
            };
        });
        panel.querySelector('#qa-color').oninput = (e) => color = e.target.value;
        panel.querySelector('#qa-size').oninput = (e) => size = parseInt(e.target.value);
        panel.querySelector('#qa-undo').onclick = () => { if (history.length) ctx.putImageData(history.pop(), 0, 0); };
        panel.querySelector('#qa-cancel').onclick = () => {
            panel.remove();
            onSave(null); // restore UI without adding evidence
        };
        panel.querySelector('#qa-save').onclick = () => {
            const annotated = canvas.toDataURL('image/png');
            panel.remove();
            onSave(annotated);
        };
    }

    function sanitize(str) {
        if (!str) return '';
        const txt = document.createElement("textarea");
        txt.innerHTML = str;
        const decoded = txt.value;

        const div = document.createElement('div');
        div.innerText = decoded;
        return div.innerHTML;
    }

    function setupDrag(w, header, hooks = {}) {
        let isDragging = false, startX, startY, initialLeft, initialTop;
        header.addEventListener('mousedown', (e) => {
            isDragging = true; startX = e.clientX; startY = e.clientY;
            initialLeft = w.getBoundingClientRect().left; initialTop = w.getBoundingClientRect().top;
            document.body.style.userSelect = 'none';
            if (typeof hooks.onStart === 'function') hooks.onStart();
        });
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            w.style.left = `${initialLeft + deltaX}px`;
            w.style.top = `${initialTop + deltaY}px`;
            w.style.bottom = 'auto'; w.style.right = 'auto';
            if (typeof hooks.onMove === 'function' && (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3)) {
                hooks.onMove();
            }
        });
        document.addEventListener('mouseup', () => {
            if (!isDragging) return;
            isDragging = false;
            document.body.style.userSelect = '';
            if (typeof hooks.onEnd === 'function') hooks.onEnd();
        });
    }
})();
