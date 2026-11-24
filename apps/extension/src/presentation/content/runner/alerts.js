/* Alertas de tempo: passo demorado (2x a media) e teste pausado por muito tempo. */
import { S } from './state.js';
import { ctElapsedMs, onTick } from './timers.js';
import { showToast } from './toast.js';
import { averageStepMs, isLongPause, isSlowStep } from '../../../domain/runAlerts.js';
import { formatDuration } from '../../../domain/runTimer.js';

let wired = false;

function flashBubble() {
    const bubble = document.getElementById('qualiflow-runner-bubble');
    if (!bubble) return;
    bubble.classList.add('is-alert');
    setTimeout(() => bubble.classList.remove('is-alert'), 6000);
}

function check() {
    const st = S.runnerState;
    if (!S.alertsEnabled || !st || !st.runId || st.currentTcIndex >= st.testCases.length) return;
    const tc = st.testCases[st.currentTcIndex];

    if (st.paused) {
        if (isLongPause({ pausedForMs: Date.now() - (st.pauseStartedAt || Date.now()) }) && st.pauseAlertedFor !== st.pauseCount) {
            st.pauseAlertedFor = st.pauseCount;
            showToast('O teste está pausado há mais de 5 minutos. Retome para continuar a contagem.', { kind: 'warn' });
            flashBubble();
        }
        return;
    }

    const results = st.stepResults?.[tc.id];
    if (!results) return;
    const done = results.filter((r) => r.outcome && r.outcome !== 'None').length;
    if (done >= results.length) return;

    const durations = [];
    Object.values(st.stepResults).forEach((list) => list.forEach((r) => {
        if (r.outcome && r.outcome !== 'None' && Number.isFinite(r.durationMs)) durations.push(r.durationMs);
    }));
    const avg = averageStepMs(durations);
    const since = ctElapsedMs(tc.id) - (st.ctMarks?.[tc.id] || 0);
    const key = `${tc.id}:${done}`;
    if (isSlowStep({ sinceMarkMs: since, avgStepMs: avg }) && st.slowAlerted !== key) {
        st.slowAlerted = key;
        showToast(`O passo ${done + 1} do CT #${tc.id} está demorando (média dos passos: ${formatDuration(avg)}).`, { kind: 'warn' });
        flashBubble();
    }
}

export function initAlerts() {
    if (wired) return;
    wired = true;
    onTick(check);
}
