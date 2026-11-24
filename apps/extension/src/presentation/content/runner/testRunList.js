import { sendRuntimeMessage } from '../shared/runtime.js';
import { S } from './state.js';
import { escapeHtml } from '../dashboard/helpers.js';
import { renderExecutionUI } from './executionView.js';
import { RuntimeActions } from '../../../contracts/runtimeActions.js';
import { createTimer, timerStart } from '../../../domain/runTimer.js';
import { logEvent } from './runLog.js';
import { selectAllIds, toggleId, filterSelected } from '../../../domain/runSelection.js';
import { startProbe, clearProbe } from './probeClient.js';
import { persistRunNow } from './runStore.js';

export function fetchTestCasesAndRender(content) {
    content.innerHTML = '<div class="qualiflow-loading">Buscando casos de teste...</div>';
    sendRuntimeMessage({ action: RuntimeActions.GET_TEST_CASES_FOR_WORKITEM, workItemId: S.activeSession.workItemId }, (response) => {
        if (!response || response.error) {
            content.innerHTML = `<div class="qualiflow-error-box" role="alert">Erro ao buscar testes: ${escapeHtml(response?.error)}</div>`;
            return;
        }
        const tcs = response.data || [];
        if (tcs.length === 0) {
            content.innerHTML = '<div class="qualiflow-empty">Nenhum teste encontrado.</div>';
            return;
        }
        renderTestCaseList(tcs, content);
    });
}

function renderTestCaseList(tcs, content) {
    let selected = selectAllIds(tcs);

    const paint = () => {
        const count = selected.size;
        content.innerHTML = `
            <div class="qualiflow-run-heading">${tcs.length} caso(s) de teste vinculado(s)</div>
            <div class="qualiflow-run-select-bar">
                <span id="qualiflow-select-count" aria-live="polite">${count} de ${tcs.length} selecionado(s)</span>
                <span class="qualiflow-u-grow"></span>
                <button type="button" class="qualiflow-hub-link" data-sel="all">Todos</button>
                <button type="button" class="qualiflow-hub-link" data-sel="none">Nenhum</button>
            </div>
            ${tcs.map((tc) => `
                <label class="qualiflow-card qualiflow-card-raised qualiflow-run-tc-card is-selectable${selected.has(tc.id) ? ' is-checked' : ''}">
                    <input type="checkbox" data-tc="${escapeHtml(tc.id)}"${selected.has(tc.id) ? ' checked' : ''} aria-label="Executar CT ${escapeHtml(tc.id)}">
                    <span class="qualiflow-run-tc-info">
                        <span class="qualiflow-run-id">#${escapeHtml(tc.id)}</span>
                        <span class="qualiflow-run-tc-title">${escapeHtml(tc.title)}</span>
                    </span>
                </label>`).join('')}
            <button type="button" id="qualiflow-start-run-btn" class="qualiflow-btn qualiflow-btn-primary qualiflow-u-mt-3"${count === 0 ? ' disabled' : ''}>
                <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3l14 9-14 9V3z"></path></svg>
                Iniciar execução (${count})
            </button>`;
        content.querySelectorAll('[data-tc]').forEach((box) => {
            box.addEventListener('change', () => {
                const tc = tcs.find((t) => String(t.id) === box.dataset.tc);
                if (tc) selected = toggleId(selected, tc.id);
                paint();
            });
        });
        content.querySelectorAll('[data-sel]').forEach((b) => {
            b.addEventListener('click', () => { selected = b.dataset.sel === 'all' ? selectAllIds(tcs) : new Set(); paint(); });
        });
        document.getElementById('qualiflow-start-run-btn').addEventListener('click', () => {
            const chosen = filterSelected(tcs, selected);
            if (chosen.length) initializeTestRun(chosen);
        });
    };
    paint();
}

// ─── EXECUTION INIT ───────────────────────────────────────────────────────

export function initializeTestRun(tcs) {
    const content = document.getElementById('qualiflow-runner-content');
    content.innerHTML = '<div class="qualiflow-run-status qualiflow-run-status-info" role="status">Preparando Test Run no Azure DevOps...<span class="qualiflow-run-status-sub">Isso cria um histórico real de execução.</span></div>';

    const tcIds = tcs.map(t => t.id);
    sendRuntimeMessage({ action: RuntimeActions.GET_TEST_POINTS_FOR_TEST_CASES, testCaseIds: tcIds }, (ptResp) => {
        let pointIds = [];
        let planId = null;
        if (ptResp && !ptResp.error && ptResp.data && ptResp.data.length > 0) {
            pointIds = ptResp.data.map(p => p.pointId);
            planId = ptResp.data[0].planId;
        }

        const runTitle = `QualiFlow Ext Run - PBI ${S.activeSession.workItemId}`;

        sendRuntimeMessage({ action: RuntimeActions.CREATE_TEST_RUN, title: runTitle, planId, pointIds }, (runResp) => {
            if (!runResp || runResp.error) {
                content.innerHTML = `<div class="qualiflow-error-box" role="alert">Erro ao criar Test Run: ${runResp?.error || ''}</div>`;
                return;
            }

            const runId = runResp.runId;

            // If Ad-Hoc (no test points linked) we manually add the results to the Run
            if (pointIds.length === 0) {
                sendRuntimeMessage({ action: RuntimeActions.ADD_ADHOC_RESULTS, runId, testCaseIds: tcIds }, (addResp) => {
                    if (!addResp || addResp.error) {
                        content.innerHTML = `<div class="qualiflow-error-box" role="alert">Erro ao inicializar Run ad-hoc: ${addResp?.error || ''}</div>`;
                        return;
                    }
                    finalizeRunInit(runId, tcs, addResp.data || []);
                });
            } else {
                sendRuntimeMessage({ action: RuntimeActions.GET_RUN_RESULTS, runId }, (resResp) => {
                    finalizeRunInit(runId, tcs, resResp?.data || []);
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

    S.runnerState = {
        testCases: tcs,
        currentTcIndex: 0,
        runId,
        results: mappedResults,
        stepResults: {},
        overallOutcomes: {},
        comments: {},
        commentVisible: {},
        evidences: {},  // key: `${tcId}` or `${tcId}_step_${stepIdx}`, value: [{name, dataUrl, type}]
        finalOutcomes: {},                                 // tcId -> outcome ja gravado no Azure
        runTimer: timerStart(createTimer(), Date.now()),   // cronometro total da execucao
        ctTimers: {},                                      // tcId -> timer do caso de teste
        ctMarks: {},                                       // tcId -> ms do CT na ultima marcacao de passo
        ctDurations: {},                                   // tcId -> duracao (ms) gravada no Azure
        events: [],                                        // atividade recente (HUB)
        bugs: [],
        paused: false,
        pauseCount: 0,
        pausedMs: 0,
        startedAt: Date.now()
    };
    logEvent(`Execução iniciada (${tcs.length} CT${tcs.length === 1 ? '' : 's'})`);
    clearProbe();
    if (S.probeEnabled) startProbe();
    persistRunNow();
    renderExecutionUI();
}
