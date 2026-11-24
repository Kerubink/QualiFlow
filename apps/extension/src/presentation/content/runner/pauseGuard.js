/*
 * Camada de bloqueio da pagina sob teste enquanto a execucao esta pausada.
 * Fica abaixo do runner e da bolinha (que continuam clicaveis) e acima do sistema testado.
 */
import { S } from './state.js';
import { setAutofillSuspended } from './autofill.js';
import { isPaused } from './timers.js';
import { togglePause } from './executionView.js';

const GUARD_ID = 'qualiflow-pause-guard';

function runInProgress() {
    const st = S.runnerState;
    return !!(st && st.runId && st.currentTcIndex < st.testCases.length);
}

export function syncPauseGuard() {
    const shouldShow = runInProgress() && isPaused();
    const existing = document.getElementById(GUARD_ID);
    if (shouldShow && !existing) {
        const guard = document.createElement('div');
        guard.id = GUARD_ID;
        guard.className = 'qualiflow-root qualiflow-pause-guard';
        guard.setAttribute('role', 'alertdialog');
        guard.setAttribute('aria-label', 'Teste pausado');
        guard.innerHTML = `
            <div class="qualiflow-pause-guard-card">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"></rect><rect x="14" y="5" width="4" height="14" rx="1"></rect></svg>
                <div class="qualiflow-pause-guard-title">Teste pausado</div>
                <div class="qualiflow-pause-guard-text">O cronômetro está parado e a interação com o sistema foi bloqueada. Retome para continuar testando.</div>
                <button type="button" class="qualiflow-btn qualiflow-btn-primary" id="qualiflow-pause-guard-resume">Retomar teste</button>
            </div>`;
        document.body.appendChild(guard);
        guard.querySelector('#qualiflow-pause-guard-resume').addEventListener('click', () => {
            togglePause();
        });
    } else if (!shouldShow && existing) {
        existing.remove();
    }
    setAutofillSuspended(shouldShow);
}

export function initPauseGuard() {
    document.addEventListener('qualiflow:run-state', syncPauseGuard);
}
