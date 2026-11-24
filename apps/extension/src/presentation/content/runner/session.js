import { escapeHtml } from '../dashboard/helpers.js';
import { getStorage, removeStorage } from '../shared/runtime.js';
import { S } from './state.js';
import { renderExecutionUI } from './executionView.js';
import { fetchTestCasesAndRender } from './testRunList.js';
import { notifyRunStateChanged } from './timers.js';
import { clearPersistedRun, readRestorable, restoreFromSnapshot } from './runStore.js';
import { summarizeRun } from '../../../domain/runTimer.js';

export function loadSession() {
    const sessionInfo = document.getElementById('qualiflow-runner-session-info');
    const content = document.getElementById('qualiflow-runner-content');

    sessionInfo.innerHTML = '<div class="qualiflow-loading">Verificando sessão...</div>';
    content.innerHTML = '';

    getStorage(['runnerActiveSession'], (data) => {
        S.activeSession = data.runnerActiveSession;
        if (!S.activeSession || !S.activeSession.workItemId || (Date.now() - S.activeSession.timestamp > 2 * 60 * 60 * 1000)) {
            sessionInfo.innerHTML = `
                <div class="qualiflow-empty">
                    <div class="qualiflow-empty-title">Nenhuma sessão ativa</div>
                    <div>Inicie a execução a partir do Azure Boards.</div>
                </div>
            `;
            return;
        }

        sessionInfo.innerHTML = `
            <div class="qualiflow-run-session-line" title="${escapeHtml(S.activeSession.workItemTitle)}">
                <span class="qualiflow-run-eyebrow">PBI #${S.activeSession.workItemId}</span>
                <span class="qualiflow-run-session-name">${escapeHtml(S.activeSession.workItemTitle)}</span>
            </div>
        `;

        if (S.runnerState && S.runnerState.runId) {
            // Resume ongoing run
            renderExecutionUI();
        } else {
            readRestorable(S.activeSession.workItemId, (snap) => {
                if (snap) renderRestoreOffer(content, snap); else fetchTestCasesAndRender(content);
            });
        }
    });
}

function renderRestoreOffer(content, snap) {
    const sum = summarizeRun(snap.testCases, snap.finalOutcomes || {}, snap.currentTcIndex);
    const savedAt = new Date(snap.savedAt).toLocaleString('pt-BR');
    content.innerHTML = `
        <div class="qualiflow-card qualiflow-card-raised qualiflow-run-restore">
            <div class="qualiflow-run-eyebrow">Execução anterior encontrada</div>
            <div class="qualiflow-run-restore-text">${sum.done} de ${sum.total} CT(s) concluído(s). Salva em ${escapeHtml(savedAt)}.
                O tempo em que a página ficou fechada não é contado.</div>
            <div class="qualiflow-run-done-actions">
                <button type="button" id="qualiflow-restore-btn" class="qualiflow-btn qualiflow-btn-success">Retomar execução</button>
                <button type="button" id="qualiflow-restore-discard" class="qualiflow-btn qualiflow-run-tool-btn">Descartar e recomeçar</button>
            </div>
        </div>`;
    document.getElementById('qualiflow-restore-btn').addEventListener('click', () => {
        restoreFromSnapshot(snap);
        renderExecutionUI();
    });
    document.getElementById('qualiflow-restore-discard').addEventListener('click', () => {
        clearPersistedRun(() => fetchTestCasesAndRender(content));
    });
}

export function endSession() {
    if (S.runnerState && S.runnerState.runId) {
        if (!confirm("Sessão em andamento. Ao encerrar, a execução no Azure (Test Run) ficará incompleta e precisará ser abortada manualmente. Deseja sair?")) return;
    }
    clearPersistedRun();
    removeStorage('runnerActiveSession', () => {
        S.activeSession = null;
        S.runnerState = null;
        notifyRunStateChanged();
        loadSession();
    });
}
