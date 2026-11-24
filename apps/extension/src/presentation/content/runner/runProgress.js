import { removeStorage, sendRuntimeMessage } from '../shared/runtime.js';
import { S } from './state.js';
import { renderExecutionUI } from './executionView.js';
import { loadSession } from './session.js';
import { ctElapsedMs, enterCt, notifyRunStateChanged, pauseCtTimer, runElapsedMs, stopTicker } from './timers.js';
import { formatDuration, summarizeRun } from '../../../domain/runTimer.js';
import { logEvent } from './runLog.js';
import { clearPersistedRun, persistRunNow } from './runStore.js';
import { copyReportMarkdown, downloadReportHtml } from './runReportExport.js';
import { failedIds, filterSelected } from '../../../domain/runSelection.js';
import { initializeTestRun } from './testRunList.js';
import { showToast } from './toast.js';
import { RuntimeActions } from '../../../contracts/runtimeActions.js';

export function finishCurrentTestCase(outcome) {
    const tc = S.runnerState.testCases[S.runnerState.currentTcIndex];
    const tcResultMeta = S.runnerState.results.find(r => Number(r.testCaseId) === Number(tc.id));
    // Comment may live in the visible textarea OR in saved state (when box is collapsed)
    const liveTextarea = document.getElementById('qualiflow-overall-comment');
    const comment = (liveTextarea ? liveTextarea.value : (S.runnerState.comments[tc.id] || '')).trim();
    // Persist in state for safety
    if (!S.runnerState.comments) S.runnerState.comments = {};
    S.runnerState.comments[tc.id] = comment;
    const stepResults = S.runnerState.stepResults[tc.id] || [];

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
    pauseCtTimer(tc.id);
    const durationMs = ctElapsedMs(tc.id);
    content.innerHTML = '<div class="qualiflow-run-status qualiflow-run-status-ok" role="status">Salvando resultado no Azure...</div>';

    sendRuntimeMessage({
        action: RuntimeActions.UPDATE_TEST_RESULT,
        runId: S.runnerState.runId,
        resultId: tcResultMeta.resultId,
        outcome,
        comment,
        stepResults,
        durationMs
    }, (res) => {
        if (!res || res.error) {
            alert("Erro ao salvar resultado: " + (res?.error || "Resposta vazia"));
            renderExecutionUI();
        } else {
            S.runnerState.finalOutcomes[tc.id] = outcome;
            if (!S.runnerState.ctDurations) S.runnerState.ctDurations = {};
            S.runnerState.ctDurations[tc.id] = durationMs;
            logEvent(`CT #${tc.id} salvo: ${outcome} (${formatDuration(durationMs)})`);
            S.runnerState.currentTcIndex++;
            const next = S.runnerState.testCases[S.runnerState.currentTcIndex];
            if (next) enterCt(next.id);
            if (next) persistRunNow(); else clearPersistedRun();
            renderExecutionUI();
        }
    });
}

export function renderRunCompletedUI(content) {
    stopTicker();
    clearPersistedRun();
    const st = S.runnerState;
    const sum = summarizeRun(st.testCases, st.finalOutcomes, st.currentTcIndex);
    const failed = failedIds(st.testCases, st.finalOutcomes);
    content.innerHTML = `
        <div class="qualiflow-run-done">
            <div class="qualiflow-run-done-title">Execução finalizada</div>
            <div class="qualiflow-run-done-text">Todos os casos de teste vinculados a este PBI foram avaliados. Encerre para registrar a conclusão no Azure.</div>
            <div class="qualiflow-run-done-stats">
                <div class="qualiflow-run-stat"><span class="qualiflow-run-stat-label">Tempo total</span><span class="qualiflow-run-stat-value qualiflow-run-mono">${formatDuration(runElapsedMs())}</span></div>
                <div class="qualiflow-run-stat"><span class="qualiflow-run-stat-label">Aprovados</span><span class="qualiflow-run-stat-value is-pass">${sum.passed}</span></div>
                <div class="qualiflow-run-stat"><span class="qualiflow-run-stat-label">Reprovados</span><span class="qualiflow-run-stat-value is-fail">${sum.failed}</span></div>
                <div class="qualiflow-run-stat"><span class="qualiflow-run-stat-label">Outros</span><span class="qualiflow-run-stat-value">${sum.blocked + sum.other}</span></div>
                <div class="qualiflow-run-stat"><span class="qualiflow-run-stat-label">Sem resultado</span><span class="qualiflow-run-stat-value">${sum.pending}</span></div>
            </div>
            <div class="qualiflow-run-done-actions">
                <button type="button" id="qualiflow-report-copy-btn" class="qualiflow-btn qualiflow-run-tool-btn">Copiar relatório (Markdown)</button>
                <button type="button" id="qualiflow-report-html-btn" class="qualiflow-btn qualiflow-run-tool-btn">Baixar relatório (HTML)</button>
            </div>
            <div class="qualiflow-run-done-actions">
                <button type="button" id="qualiflow-review-run-btn" class="qualiflow-btn qualiflow-run-tool-btn">Revisar casos</button>
                ${failed.size ? `<button type="button" id="qualiflow-rerun-failed-btn" class="qualiflow-btn qualiflow-run-tool-btn">Re-executar reprovados (${failed.size})</button>` : ''}
                <button type="button" id="qualiflow-complete-run-btn" class="qualiflow-btn qualiflow-btn-success">
                    Encerrar sessão e fechar run
                </button>
            </div>
        </div>
    `;

    document.getElementById('qualiflow-report-copy-btn').addEventListener('click', () => {
        copyReportMarkdown().then(() => showToast('Relatório (Markdown) copiado.', { kind: 'success' }));
    });
    document.getElementById('qualiflow-report-html-btn').addEventListener('click', downloadReportHtml);
    const rerun = document.getElementById('qualiflow-rerun-failed-btn');
    if (rerun) {
        rerun.addEventListener('click', () => {
            if (!confirm(`Encerrar esta execução e iniciar uma nova apenas com os ${failed.size} CT(s) reprovado(s)?`)) return;
            const subset = filterSelected(st.testCases, failed);
            content.innerHTML = '<div class="qualiflow-run-status qualiflow-run-status-ok" role="status">Encerrando a execução atual...</div>';
            sendRuntimeMessage({ action: RuntimeActions.COMPLETE_TEST_RUN, runId: st.runId, state: 'Completed' }, (res) => {
                if (res && res.error) alert('Erro ao concluir a execução atual: ' + res.error);
                S.runnerState = null;
                notifyRunStateChanged();
                initializeTestRun(subset);
            });
        });
    }

    document.getElementById('qualiflow-review-run-btn').addEventListener('click', () => {
        S.runnerState.currentTcIndex = 0;
        enterCt(S.runnerState.testCases[0].id);
        renderExecutionUI();
    });

    document.getElementById('qualiflow-complete-run-btn').addEventListener('click', () => {
        content.innerHTML = '<div class="qualiflow-run-status qualiflow-run-status-ok" role="status">Concluindo histórico no servidor...</div>';
        sendRuntimeMessage({ action: RuntimeActions.COMPLETE_TEST_RUN, runId: S.runnerState.runId, state: 'Completed' }, (res) => {
            if (!res || res.error) {
                alert("Erro ao concluir Test Run: " + res?.error);
            }

            removeStorage('runnerActiveSession', () => {
                S.activeSession = null;
                S.runnerState = null;
                notifyRunStateChanged();
                loadSession();
            });
        });
    });
}
