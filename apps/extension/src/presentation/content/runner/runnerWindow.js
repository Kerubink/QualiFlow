import { setupDrag } from './helpers.js';
import { getStorage, setStorage } from '../shared/runtime.js';
import { loadSession } from './session.js';
import { S } from './state.js';
import { togglePause } from './executionView.js';
import { bindHeaderTimer, renderHeaderTimer } from './headerBar.js';
import { toggleHub } from './hub.js';
import { toggleCriteria } from './criteriaPanel.js';
import { toggleUiToolbar } from './uiToolbar.js';
import { disableDockFix, enableDockFix } from './dockFix.js';
import { toggleConsole, updateConsoleBadge } from './consolePanel.js';
import { initSettingsMenu } from './settingsMenu.js';
import { ctElapsedMs, isPaused, onTick, runElapsedMs } from './timers.js';
import { bubbleStatus } from '../../../domain/runTimer.js';

export function openRunnerWindow() {
    let w = document.getElementById('qualiflow-runner-window');
    if (!w) {
        w = document.createElement('div');
        w.id = 'qualiflow-runner-window';
        w.className = 'qualiflow-root qualiflow-hidden';
        w.setAttribute('role', 'dialog');
        w.setAttribute('aria-labelledby', 'qualiflow-runner-title');
        w.innerHTML = `
            <div id="qualiflow-runner-header" class="qualiflow-run-header">
                <div id="qualiflow-runner-title" class="qualiflow-run-title">
                    <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347c-.75.412-1.667-.13-1.667-.986V5.653z"></path></svg>
                    Test Runner
                </div>
                <div class="qualiflow-run-header-actions">
                    <div id="qualiflow-runner-timerbar" class="qualiflow-run-timerbar" hidden></div>
                    <button type="button" id="qualiflow-runner-console" class="qualiflow-close qualiflow-run-hdr-icon" aria-pressed="false" aria-label="Console" title="Console">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
                        <span id="qualiflow-console-badge" class="qualiflow-run-hdr-badge" hidden>0</span>
                    </button>
                    <button type="button" id="qualiflow-runner-uitools" class="qualiflow-close qualiflow-run-hdr-icon" aria-pressed="false" aria-label="Ferramentas de UI e UX" title="Ferramentas de UI e UX (Alt+U)">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.7 6.3a4 4 0 005.4 5.4l-9.4 9.4a2.1 2.1 0 01-3-3z"></path><path d="M16 4l4 4"></path></svg>
                    </button>
                    <button type="button" id="qualiflow-runner-criteria" class="qualiflow-close qualiflow-run-hdr-icon" aria-pressed="false" aria-label="Critérios de aceite do card" title="Critérios de aceite do card">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"></path></svg>
                    </button>
                    <button type="button" id="qualiflow-runner-hub" class="qualiflow-close qualiflow-run-hdr-icon" aria-pressed="false" aria-label="HUB da execução" title="HUB da execução">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="9" rx="1"></rect><rect x="14" y="3" width="7" height="5" rx="1"></rect><rect x="14" y="12" width="7" height="9" rx="1"></rect><rect x="3" y="16" width="7" height="5" rx="1"></rect></svg>
                    </button>
                    <button type="button" id="qualiflow-runner-settings" class="qualiflow-close qualiflow-run-hdr-icon" aria-haspopup="menu" aria-expanded="false" aria-label="Configurações" title="Configurações">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33h.01a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51h.01a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82v.01a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"></path></svg>
                    </button>
                    <button type="button" id="qualiflow-runner-minimize" class="qualiflow-close" aria-label="Minimizar" title="Minimizar">&minus;</button>
                    <button type="button" id="qualiflow-runner-close" class="qualiflow-close" aria-label="Fechar" title="Fechar">&times;</button>
                </div>
            </div>
            <div id="qualiflow-runner-body" class="qualiflow-run-body">
                <div id="qualiflow-runner-session-info" aria-live="polite"></div>
                <div id="qualiflow-runner-content" aria-live="polite"></div>
            </div>
        `;
        document.body.appendChild(w);

        document.getElementById('qualiflow-runner-close').addEventListener('click', () => { w.classList.add('qualiflow-hidden'); syncDockPush(w); });
        document.getElementById('qualiflow-runner-minimize').addEventListener('click', () => minimizeRunnerWindow(w));
        setupDrag(w, document.getElementById('qualiflow-runner-header'), { canStart: () => !docked, onEnd: () => saveGeometry(w) });
        initSettingsMenu(w, { isDocked: () => docked, toggleDock: () => setDocked(w, !docked) });
        document.getElementById('qualiflow-runner-hub').addEventListener('click', toggleHub);
        document.getElementById('qualiflow-runner-criteria').addEventListener('click', toggleCriteria);
        document.getElementById('qualiflow-runner-uitools').addEventListener('click', toggleUiToolbar);
        document.getElementById('qualiflow-runner-console').addEventListener('click', toggleConsole);
        document.addEventListener('qualiflow:probe-event', updateConsoleBadge);
        updateConsoleBadge();
        bindHeaderTimer(togglePause);
        onTick(renderHeaderTimer);
        document.addEventListener('qualiflow:run-state', renderHeaderTimer);

        w.style.right = '100px';
        w.style.bottom = '100px';
        getStorage([GEOM_KEY], (d) => applyGeometry(w, d[GEOM_KEY]));
        watchResize(w);
    }
    hideRunnerBubble();
    w.classList.remove('qualiflow-hidden');
    syncDockPush(w);
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
    renderBubbleStatus();

    w.classList.add('qualiflow-hidden');
    syncDockPush(w);
}

function ensureRunnerBubble() {
    let bubble = document.getElementById('qualiflow-runner-bubble');
    if (bubble) return bubble;

    bubble = document.createElement('div');
    bubble.id = 'qualiflow-runner-bubble';
    bubble.className = 'qualiflow-root qualiflow-hidden';
    bubble.title = 'Abrir Test Runner';
    bubble.setAttribute('role', 'button');
    bubble.setAttribute('tabindex', '0');
    bubble.setAttribute('aria-label', 'Abrir Test Runner');
    document.body.appendChild(bubble);
    renderBubbleStatus();
    if (!bubbleWired) {
        bubbleWired = true;
        onTick(renderBubbleStatus);
        document.addEventListener('qualiflow:run-state', renderBubbleStatus);
    }

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
    bubble.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openRunnerWindow();
        }
    });

    return bubble;
}

function hideRunnerBubble() {
    const bubble = document.getElementById('qualiflow-runner-bubble');
    if (bubble) bubble.classList.add('qualiflow-hidden');
}

// ------------------------------------------------------------ status da bolinha
let bubbleWired = false;

const BUBBLE_ICONS = {
    idle: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347c-.75.412-1.667-.13-1.667-.986V5.653z"></path></svg>',
    paused: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"></rect><rect x="14" y="5" width="4" height="14" rx="1"></rect></svg>'
};

/** Atualiza a bolinha: tempo do CT correndo, icone de pausa ou play (sem run). */
function renderBubbleStatus() {
    const bubble = document.getElementById('qualiflow-runner-bubble');
    if (!bubble) return;
    const st = S.runnerState;
    const active = !!(st && st.runId && st.currentTcIndex < st.testCases.length);
    const tc = active ? st.testCases[st.currentTcIndex] : null;
    const status = bubbleStatus({
        active,
        paused: active && isPaused(),
        ctMs: tc ? ctElapsedMs(tc.id) : 0,
        runMs: active ? runElapsedMs() : 0
    });

    bubble.title = status.title;
    bubble.setAttribute('aria-label', status.mode === 'idle' ? 'Abrir Test Runner' : status.title);
    if (bubble.dataset.mode !== status.mode) {
        bubble.dataset.mode = status.mode;
        bubble.innerHTML = status.mode === 'running'
            ? '<span class="qualiflow-run-bubble-time qualiflow-run-mono"></span>'
            : BUBBLE_ICONS[status.mode];
    }
    if (status.mode === 'running') {
        const timeEl = bubble.querySelector('.qualiflow-run-bubble-time');
        if (timeEl) timeEl.textContent = status.label;
    }
}

// ------------------------------------------------ geometria e ancoragem lateral
const GEOM_KEY = 'runnerWindowGeom';
const DOCK_WIDTH_PX = 420;
let docked = false;
let resizeTimer = null;

/**
 * Quando ancorada e visivel, reserva a faixa da direita para o runner: a pagina testada passa a ocupar so o
 * restante da largura (lado a lado, sem ficar por baixo). `position: relative` no <html> faz elementos
 * `absolute` em tela cheia (como o layout do Azure DevOps) usarem a largura reduzida, e o evento `resize`
 * avisa a pagina para recalcular o layout.
 */
function syncDockPush(w) {
    const root = document.documentElement;
    const on = docked && !w.classList.contains('qualiflow-hidden');
    const was = root.style.getPropertyValue('margin-right') !== '';
    if (on) {
        root.style.setProperty('margin-right', `${DOCK_WIDTH_PX}px`, 'important');
        root.style.setProperty('position', 'relative', 'important');
        enableDockFix(DOCK_WIDTH_PX);
    } else {
        disableDockFix();
        root.style.removeProperty('margin-right');
        root.style.removeProperty('position');
    }
    if (on !== was) requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
}

function setDocked(w, on, persist = true) {
    docked = on;
    w.classList.toggle('is-docked', on);
    syncDockPush(w);
    if (persist) saveGeometry(w);
}

function saveGeometry(w) {
    if (docked) { setStorage({ [GEOM_KEY]: { dock: true } }); return; }
    if (w.classList.contains('qualiflow-hidden')) return;
    const r = w.getBoundingClientRect();
    if (r.width < 100 || r.height < 60) return;
    setStorage({ [GEOM_KEY]: { dock: false, left: Math.round(r.left), top: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) } });
}

function applyGeometry(w, g) {
    if (!g) return;
    if (g.dock) { setDocked(w, true, false); return; }
    if (![g.left, g.top, g.width, g.height].every(Number.isFinite)) return;
    // mantem a janela dentro da tela (a viewport pode ter mudado desde que foi salva)
    const width = Math.min(Math.max(g.width, 340), window.innerWidth - 8);
    const height = Math.min(Math.max(g.height, 240), window.innerHeight - 8);
    w.style.width = `${width}px`;
    w.style.height = `${height}px`;
    w.style.left = `${Math.min(Math.max(0, g.left), window.innerWidth - Math.min(width, 140))}px`;
    w.style.top = `${Math.min(Math.max(0, g.top), window.innerHeight - 60)}px`;
    w.style.right = 'auto';
    w.style.bottom = 'auto';
}

function watchResize(w) {
    if (typeof ResizeObserver === 'undefined') return;
    new ResizeObserver(() => {
        if (docked) return;
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => saveGeometry(w), 500);
    }).observe(w);
}
