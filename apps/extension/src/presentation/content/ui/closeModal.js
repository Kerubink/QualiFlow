import { uiState } from './uiState.js';

export function closeModal() {
    const overlay = document.getElementById('qualiflow-modal-overlay');
    if (!overlay) return;
    overlay.classList.remove('qualiflow-open');
    setTimeout(() => {
        overlay.classList.add('qualiflow-hidden');
    }, 300); // Matches CSS transition duration
    // Devolve o foco ao gatilho que abriu o drawer, quando ainda existir.
    const trigger = uiState.modalTrigger;
    uiState.modalTrigger = null;
    if (trigger && typeof trigger.focus === 'function' && document.contains(trigger)) {
        trigger.focus();
    }
}
