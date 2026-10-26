import { detectBoardProvider } from '../shared/pageContext.js';
import { openModal } from './navigation.js';

export function injectFAB() {
    if (document.getElementById('qualiflow-fab-container')) return;

    const boardProvider = detectBoardProvider();
    const isAzureBoard = boardProvider === 'azure';

    const fabContainer = document.createElement('div');
    fabContainer.id = 'qualiflow-fab-container';
    fabContainer.className = 'qualiflow-root';

    const mainFabIcon = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 3v18h18M18 17V9M13 17V5M8 17v-3"></path></svg>`;
    const generateIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"></path></svg>`;

    const dashIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 3v18h18M18 17V9M13 17V5M8 17v-3"></path></svg>`;
    const runIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347c-.75.412-1.667-.13-1.667-.986V5.653z"></path></svg>`;

        fabContainer.innerHTML = `
            ${isAzureBoard ? `<div id="qualiflow-fab-dash" class="qualiflow-fab-sub" title="Dashboard QA" aria-label="Dashboard QA" role="button" tabindex="0">${dashIcon}</div>` : ''}
      <div id="qualiflow-fab-gen" class="qualiflow-fab-sub" title="Gerar Casos de Teste" aria-label="Gerar Casos de Teste" role="button" tabindex="0">
        ${generateIcon}
      </div>
            ${isAzureBoard ? `<div id="qualiflow-fab-run" class="qualiflow-fab-sub" title="Executar Testes" aria-label="Executar Testes" role="button" tabindex="0">${runIcon}</div>` : ''}
      <div id="qualiflow-fab-settings" class="qualiflow-fab-sub" title="Configurações" aria-label="Configurações" role="button" tabindex="0">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"></path></svg>
      </div>
      <div id="qualiflow-fab-main" title="QualiFlow Tools" aria-label="QualiFlow Tools" role="button" tabindex="0" aria-haspopup="true">
                ${mainFabIcon}
      </div>
    `;

    document.body.appendChild(fabContainer);
    if (isAzureBoard) {
        document.getElementById('qualiflow-fab-dash').addEventListener('click', () => {
            openModal('dashboard');
        });
    }
    document.getElementById('qualiflow-fab-gen').addEventListener('click', () => {
        openModal('generator');
    });
    if (isAzureBoard) {
        document.getElementById('qualiflow-fab-run').addEventListener('click', () => {
            openModal('runner');
        });
    }
    document.getElementById('qualiflow-fab-settings').addEventListener('click', () => {
        openModal('settings');
    });

    // Elementos role="button": Enter/Espaco disparam o mesmo click.
    fabContainer.querySelectorAll('[role="button"]').forEach((el) => {
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                el.click();
            }
        });
    });
}
