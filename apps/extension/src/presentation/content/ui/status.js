import { safeGetElement } from '../shared/dom.js';

const TONE_CLASSES = ['qualiflow-ui-tone-error', 'qualiflow-ui-tone-success', 'qualiflow-ui-tone-warning', 'qualiflow-ui-tone-muted'];

// Aplica a cor semantica (error|success|warning|muted) via classe, sem estilo inline.
export function setStatusTone(el, tone = 'muted') {
    if (!el) return;
    el.classList.remove(...TONE_CLASSES);
    el.classList.add(`qualiflow-ui-tone-${tone}`);
}

export function showStatus(msg, isError = false) {
    const el = safeGetElement('qualiflow-status');
    if (!el) return;
    el.textContent = msg;
    el.className = `${isError ? 'qualiflow-error' : 'qualiflow-info'} qualiflow-ui-status`;
    el.setAttribute('role', isError ? 'alert' : 'status');
    el.style.display = 'block';
}
export function hideStatus() {
    const el = safeGetElement('qualiflow-status');
    if (!el) return;
    el.style.display = 'none';
}
