import { removeStorage, sendRuntimeMessage } from '../shared/runtime.js';
import { S } from './state.js';
import { renderExecutionUI } from './executionView.js';
import { loadSession } from './session.js';
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
    content.innerHTML = '<div class="qualiflow-run-status qualiflow-run-status-ok" role="status"><div class="qualiflow-run-status-icon" aria-hidden="true">💾</div>Salvando resultado no Azure...</div>';

    sendRuntimeMessage({
        action: RuntimeActions.UPDATE_TEST_RESULT,
        runId: S.runnerState.runId,
        resultId: tcResultMeta.resultId,
        outcome,
        comment,
        stepResults
    }, (res) => {
        if (!res || res.error) {
            alert("Erro ao salvar resultado: " + (res?.error || "Resposta vazia"));
            renderExecutionUI();
        } else {
            S.runnerState.currentTcIndex++;
            renderExecutionUI();
        }
    });
}

export function renderRunCompletedUI(content) {
    content.innerHTML = `
        <div class="qualiflow-run-done">
            <div class="qualiflow-run-done-icon" aria-hidden="true">🏁</div>
            <div class="qualiflow-run-done-title">Execução Finalizada!</div>
            <div class="qualiflow-run-done-text">Todos os testes vinculados a este PBI foram avaliados. Vamos encerrar e registrar no Azure.</div>
            
            <button type="button" id="qualiflow-complete-run-btn" class="qualiflow-btn qualiflow-btn-success">
                Encerrar Sessão e Fechar Run
            </button>
        </div>
    `;

    document.getElementById('qualiflow-complete-run-btn').addEventListener('click', () => {
        content.innerHTML = '<div class="qualiflow-run-status qualiflow-run-status-ok" role="status">Concluindo histórico no servidor...</div>';
        sendRuntimeMessage({ action: RuntimeActions.COMPLETE_TEST_RUN, runId: S.runnerState.runId, state: 'Completed' }, (res) => {
            if (!res || res.error) {
                alert("Erro ao concluir Test Run: " + res?.error);
            }

            removeStorage('runnerActiveSession', () => {
                S.activeSession = null;
                S.runnerState = null;
                loadSession();
            });
        });
    });
}
