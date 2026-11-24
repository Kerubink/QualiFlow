/* Dialogo simples com a lista de atalhos de teclado do runner. */
import { SHORTCUTS } from './shortcuts.js';

export function showShortcutsDialog() {
    if (document.getElementById('qualiflow-shortcuts-dialog')) return;
    const overlay = document.createElement('div');
    overlay.id = 'qualiflow-shortcuts-dialog';
    overlay.className = 'qualiflow-root qualiflow-dialog-overlay qualiflow-run-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'qf-sc-title');
    overlay.innerHTML = `
      <div class="qualiflow-dialog qualiflow-dialog-sm qualiflow-dialog-surface">
        <div class="qualiflow-dialog-head">
          <span id="qf-sc-title" class="qualiflow-dialog-title">Atalhos de teclado</span>
          <button type="button" class="qualiflow-close" id="qf-sc-close" aria-label="Fechar">&times;</button>
        </div>
        <div class="qualiflow-run-shortcuts">
          <p class="qualiflow-run-note">Valem com uma execução em andamento, em qualquer lugar da página.</p>
          <dl>${SHORTCUTS.map((s) => `<div><dt><kbd>${s.keys.split(' + ').join('</kbd> <kbd>')}</kbd></dt><dd>${s.label}</dd></div>`).join('')}</dl>
          <p class="qualiflow-run-note">No editor de capturas: V P L A R E H B T N C escolhem a ferramenta; Ctrl+Z/Ctrl+Y desfazem/refazem; Enter aplica o recorte; Ctrl+Enter salva.</p>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const close = () => { document.removeEventListener('keydown', onKey, true); overlay.remove(); };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    document.addEventListener('keydown', onKey, true);
    overlay.querySelector('#qf-sc-close').onclick = close;
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    overlay.querySelector('#qf-sc-close').focus();
}
