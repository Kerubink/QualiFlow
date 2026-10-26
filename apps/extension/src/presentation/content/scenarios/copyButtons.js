import { state } from '../state.js';
import { isManualCopyContext } from '../../../domain/copiedScenario.js';

// Mostra o botao de ajustes automaticos apenas no modo manual (CTs copiados, ainda sem RTM).
export function syncCopyFlowButtons() {
    const autoBtn = document.getElementById('btn-copy-auto-adjust');
    if (!autoBtn) return;

    autoBtn.classList.toggle('qualiflow-hidden', !isManualCopyContext(state.currentCopyContext));
}
