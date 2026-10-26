import { setupDrag } from './helpers.js';
import { loadSession } from './session.js';

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
                    QualiFlow Test Runner
                </div>
                <div class="qualiflow-run-header-actions">
                    <button type="button" id="qualiflow-runner-minimize" class="qualiflow-close" aria-label="Minimizar" title="Minimizar">&minus;</button>
                    <button type="button" id="qualiflow-runner-close" class="qualiflow-close" aria-label="Fechar" title="Fechar">&times;</button>
                </div>
            </div>
            <div id="qualiflow-runner-body" class="qualiflow-run-body">
                <div id="qualiflow-runner-session-info" class="qualiflow-u-mb-4" aria-live="polite"></div>
                <div id="qualiflow-runner-content" aria-live="polite"></div>
            </div>
        `;
        document.body.appendChild(w);

        document.getElementById('qualiflow-runner-close').addEventListener('click', () => w.classList.add('qualiflow-hidden'));
        document.getElementById('qualiflow-runner-minimize').addEventListener('click', () => minimizeRunnerWindow(w));
        setupDrag(w, document.getElementById('qualiflow-runner-header'));

        w.style.right = '100px';
        w.style.bottom = '100px';
    }
    hideRunnerBubble();
    w.classList.remove('qualiflow-hidden');
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

    w.classList.add('qualiflow-hidden');
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
    bubble.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347c-.75.412-1.667-.13-1.667-.986V5.653z"></path></svg>`;
    document.body.appendChild(bubble);

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
