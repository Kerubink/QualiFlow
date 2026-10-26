
const QUALIFLOW_UI_HIDE_IDS = [
    'qualiflow-evidence-overlay',
    'qualiflow-runner-window',
    'qualiflow-runner-bubble',
    'qualiflow-fab-container',
    'qualiflow-rec-floating',
];

/** Hide runner chrome so capture/recording does not include our overlays. */
export function hideQualiFlowUiForCapture(exceptIds = []) {
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

export function showQualiFlowUiAfterCapture() {
    QUALIFLOW_UI_HIDE_IDS.forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.style.removeProperty('visibility');
        el.style.removeProperty('pointer-events');
        el.style.removeProperty('opacity');
    });
}

/** Wait for browser paint so captureVisibleTab does not include our UI. */
export function waitForUiHidden() {
    return new Promise((resolve) => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                setTimeout(resolve, 100);
            });
        });
    });
}

export function removeRecordingFloatingBar() {
    const bar = document.getElementById('qualiflow-rec-floating');
    if (bar) bar.remove();
}

export function showRecordingFloatingBar(onStop) {
    removeRecordingFloatingBar();
    const bar = document.createElement('div');
    bar.id = 'qualiflow-rec-floating';
    bar.className = 'qualiflow-root qualiflow-run-recbar';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Gravação de tela em andamento');
    bar.innerHTML = `
        <span id="qualiflow-rec-floating-timer" class="qualiflow-run-recbar-timer" role="timer" aria-live="off">⏺ 0s</span>
        <button type="button" id="qualiflow-rec-floating-stop" class="qualiflow-btn-inline qualiflow-btn-danger qualiflow-btn-sm" aria-label="Parar gravação">⏹ Parar</button>
    `;
    document.body.appendChild(bar);
    bar.querySelector('#qualiflow-rec-floating-stop').onclick = () => onStop();
    return bar;
}
