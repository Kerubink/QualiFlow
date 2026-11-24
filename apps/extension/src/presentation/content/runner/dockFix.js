/*
 * Ancoragem sem sobreposicao de elementos `position: fixed` do site testado. A margem no <html> cobre o fluxo
 * normal, mas elementos fixos (menus, toasts, barras laterais) usam a janela inteira e ficariam por baixo do runner.
 * Enquanto ancorado, os que invadem a faixa do runner sao deslocados (so `right`/`left` inline) e restaurados ao
 * desancorar. Nada do site e removido ou alterado alem disso.
 */
import { shouldShiftFixed } from '../../../domain/uiInsights.js';

const moved = new Map(); // elemento -> valores inline originais
let observer = null;
let width = 0;
let timer = null;
const pending = new Set();

const isOwn = (el) => !!el.closest?.('.qualiflow-root');

function remember(el) {
    moved.set(el, {
        right: [el.style.getPropertyValue('right'), el.style.getPropertyPriority('right')],
        left: [el.style.getPropertyValue('left'), el.style.getPropertyPriority('left')]
    });
}

function consider(el) {
    if (moved.has(el) || el === document.body || el === document.documentElement || isOwn(el)) return;
    const cs = getComputedStyle(el);
    if (cs.position !== 'fixed') return;
    const rect = el.getBoundingClientRect();
    if (!shouldShiftFixed({ position: cs.position, rect, viewportWidth: window.innerWidth, dockWidth: width })) return;
    remember(el);
    if (cs.right !== 'auto' && Number.isFinite(parseFloat(cs.right))) {
        el.style.setProperty('right', `${parseFloat(cs.right) + width}px`, 'important');
    } else {
        el.style.setProperty('left', `${Math.max(0, rect.left - width)}px`, 'important');
    }
}

function flush() {
    timer = null;
    const nodes = [...pending];
    pending.clear();
    for (const node of nodes) {
        if (!node.isConnected) continue;
        consider(node);
        // um no novo pode conter fixos dentro (limite para nao pesar em grandes arvores)
        node.querySelectorAll?.('*').forEach((child, i) => { if (i < 300) consider(child); });
    }
}

export function enableDockFix(dockWidth) {
    if (observer) return;
    width = dockWidth;
    document.body.querySelectorAll('*').forEach(consider);
    observer = new MutationObserver((mutations) => {
        for (const m of mutations) m.addedNodes.forEach((n) => { if (n.nodeType === 1) pending.add(n); });
        if (pending.size && !timer) timer = setTimeout(flush, 300);
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

export function disableDockFix() {
    if (!observer) return;
    observer.disconnect();
    observer = null;
    clearTimeout(timer);
    timer = null;
    pending.clear();
    for (const [el, prev] of moved) {
        for (const prop of ['right', 'left']) {
            const [value, priority] = prev[prop];
            if (value) el.style.setProperty(prop, value, priority); else el.style.removeProperty(prop);
        }
    }
    moved.clear();
}
