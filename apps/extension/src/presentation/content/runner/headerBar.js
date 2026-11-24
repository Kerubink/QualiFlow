/*
 * Cronometro compacto do cabecalho do runner (tempo do CT + pausar/retomar).
 * Fica na barra da janela, junto dos botoes de HUB, configuracoes, minimizar e fechar.
 */
import { S } from './state.js';
import { ctElapsedMs, isPaused, runElapsedMs } from './timers.js';
import { formatDuration } from '../../../domain/runTimer.js';

const PAUSE_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"></rect><rect x="14" y="5" width="4" height="14" rx="1"></rect></svg>';
const PLAY_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15a1 1 0 001.5.86l12-7.5a1 1 0 000-1.72l-12-7.5A1 1 0 007 4.5z"></path></svg>';

export function renderHeaderTimer() {
    const bar = document.getElementById('qualiflow-runner-timerbar');
    if (!bar) return;
    const st = S.runnerState;
    const active = !!(st && st.runId && st.currentTcIndex < st.testCases.length);
    if (!active) {
        bar.hidden = true;
        bar.dataset.mode = '';
        bar.innerHTML = '';
        return;
    }
    const paused = isPaused();
    const mode = paused ? 'paused' : 'running';
    const tc = st.testCases[st.currentTcIndex];
    bar.hidden = false;
    if (bar.dataset.mode !== mode) {
        bar.dataset.mode = mode;
        const label = paused ? 'Retomar o teste' : 'Pausar o teste (bloqueia a execução)';
        bar.innerHTML = `
            <span id="qualiflow-ct-timer" class="qualiflow-run-hdr-time qualiflow-run-mono" role="timer" aria-live="off"></span>
            <button type="button" id="qualiflow-ct-timer-toggle" class="qualiflow-run-hdr-pause" aria-pressed="${paused ? 'true' : 'false'}" aria-label="${label}" title="${label}">${paused ? PLAY_SVG : PAUSE_SVG}</button>`;
    }
    const timeEl = bar.querySelector('#qualiflow-ct-timer');
    if (timeEl) timeEl.textContent = formatDuration(ctElapsedMs(tc.id));
    bar.title = `Tempo do CT: ${formatDuration(ctElapsedMs(tc.id))} | Total: ${formatDuration(runElapsedMs())}${paused ? ' (pausado)' : ''}`;
}

export function bindHeaderTimer(onToggle) {
    const bar = document.getElementById('qualiflow-runner-timerbar');
    if (!bar) return;
    bar.addEventListener('click', (e) => {
        if (e.target.closest('#qualiflow-ct-timer-toggle')) onToggle();
    });
}
