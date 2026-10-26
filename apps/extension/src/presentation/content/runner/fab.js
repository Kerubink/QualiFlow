import { openRunnerWindow } from './runnerWindow.js';

function bindActivate(el, handler) {
    el.addEventListener('click', handler);
    el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handler(e);
        }
    });
}

export function injectDisabledRunnerFAB() {
    if (document.getElementById('qualiflow-fab-container')) return;

    const fabContainer = document.createElement('div');
    fabContainer.id = 'qualiflow-fab-container';
    fabContainer.className = 'qualiflow-root qualiflow-fab-runner-only';

    const mainFabIcon = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 3v18h18M18 17V9M13 17V5M8 17v-3"></path></svg>`;
    const runIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347c-.75.412-1.667-.13-1.667-.986V5.653z"></path></svg>`;

    fabContainer.innerHTML = `
      <div id="qualiflow-fab-run" class="qualiflow-fab-sub is-disabled" role="button" tabindex="0" aria-disabled="true" aria-label="Executar Testes (indisponível no momento)" title="Executar Testes (indisponível no momento)">
        ${runIcon}
      </div>
      <div id="qualiflow-fab-main" role="button" tabindex="0" aria-label="QualiFlow Tools" title="QualiFlow Tools">
                    ${mainFabIcon}
      </div>
    `;
    document.body.appendChild(fabContainer);
    bindActivate(document.getElementById('qualiflow-fab-run'), () => {
        alert('Runner indisponível no momento.');
    });
}

// ─── FAB ────────────────────────────────────────────────────────────────

export function injectMinimalRunnerFAB() {
    if (document.getElementById('qualiflow-fab-container')) return;

    const fabContainer = document.createElement('div');
    fabContainer.id = 'qualiflow-fab-container';
    fabContainer.className = 'qualiflow-root qualiflow-fab-runner-only';

    const mainFabIcon = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 3v18h18M18 17V9M13 17V5M8 17v-3"></path></svg>`;
    const runIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347c-.75.412-1.667-.13-1.667-.986V5.653z"></path></svg>`;

    fabContainer.innerHTML = `
      <div id="qualiflow-fab-run" class="qualiflow-fab-sub" role="button" tabindex="0" aria-label="Executar Testes" title="Executar Testes">
        ${runIcon}
      </div>
      <div id="qualiflow-fab-main" role="button" tabindex="0" aria-label="QualiFlow Tools" title="QualiFlow Tools">
                    ${mainFabIcon}
      </div>
    `;
    document.body.appendChild(fabContainer);
    bindActivate(document.getElementById('qualiflow-fab-run'), openRunnerWindow);
}
