import { escapeHtml } from '../dashboard/helpers.js';
import { getStorage, removeStorage } from '../shared/runtime.js';
import { S } from './state.js';
import { renderExecutionUI } from './executionView.js';
import { fetchTestCasesAndRender } from './testRunList.js';

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
                    <div class="qualiflow-run-status-icon" aria-hidden="true">🎯</div>
                    <div class="qualiflow-empty-title">Nenhuma sessão ativa</div>
                    <div>Inicie o Run a partir do Azure Boards.</div>
                </div>
            `;
            return;
        }

        sessionInfo.innerHTML = `
            <div class="qualiflow-card qualiflow-card-raised qualiflow-run-session">
                <div class="qualiflow-run-eyebrow">Sessão Ativa</div>
                <div class="qualiflow-run-session-title">#${S.activeSession.workItemId} — ${escapeHtml(S.activeSession.workItemTitle)}</div>
                <div class="qualiflow-run-session-actions">
                    <button type="button" id="qualiflow-session-clear" class="qualiflow-btn-inline qualiflow-btn-sm qualiflow-run-btn-danger-outline">Encerrar Sessão</button>
                </div>
            </div>
        `;
        document.getElementById('qualiflow-session-clear').addEventListener('click', endSession);

        if (S.runnerState && S.runnerState.runId) {
            // Resume ongoing run
            renderExecutionUI();
        } else {
            fetchTestCasesAndRender(content);
        }
    });
}

function endSession() {
    if (S.runnerState && S.runnerState.runId) {
        if (!confirm("Sessão em andamento. Ao encerrar, a execução no Azure (Test Run) ficará incompleta e precisará ser abortada manualmente. Deseja sair?")) return;
    }
    removeStorage('runnerActiveSession', () => {
        S.activeSession = null;
        S.runnerState = null;
        loadSession();
    });
}
