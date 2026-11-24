/*
 * Depurador CSS: contorno vermelho em todos os elementos da pagina testada e, ao passar o mouse,
 * uma etiqueta com tag/classes, tamanho, padding, margin e fonte. Alt+clique copia o seletor.
 * Nunca afeta a propria UI do QualiFlow (.qualiflow-root).
 */
import { compactBox, cssSelector, elementLabel, formatSize } from '../../../domain/cssDebug.js';

const STYLE_ID = 'qualiflow-css-debug-style';
const BOX_ID = 'qualiflow-css-debug-box';
const LABEL_ID = 'qualiflow-css-debug-label';
const OUTLINE_CSS = `body *:not(.qualiflow-root, .qualiflow-root *) { outline: 1px solid rgba(255, 45, 45, 0.85) !important; outline-offset: -1px; }`;

let enabled = false;
let suspended = false;
let rafPending = false;
let lastTarget = null;
let copiedUntil = 0;

const isOwn = (el) => !!el.closest('.qualiflow-root');
const esc = (v) => (window.CSS && CSS.escape ? CSS.escape(v) : String(v).replace(/[^\w-]/g, '\\$&'));
const userClasses = (el) => Array.from(el.classList).filter((c) => !c.startsWith('qualiflow-')).map(esc);

function chainFor(el) {
    const chain = [];
    for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
        const parent = node.parentElement;
        let nth = 0;
        if (parent) {
            const same = Array.from(parent.children).filter((c) => c.tagName === node.tagName);
            if (same.length > 1) nth = same.indexOf(node) + 1;
        }
        chain.unshift({ tag: node.tagName, id: node.id ? esc(node.id) : '', classes: userClasses(node), nth });
    }
    return chain;
}

/** Seletor CSS do elemento (para relatar bugs e achados de acessibilidade). */
export function selectorFor(el) {
    return cssSelector(chainFor(el));
}

function ensureOverlay() {
    let box = document.getElementById(BOX_ID);
    let label = document.getElementById(LABEL_ID);
    if (!box) {
        box = document.createElement('div');
        box.id = BOX_ID;
        box.className = 'qualiflow-root qualiflow-cssdbg-box';
        document.body.appendChild(box);
    }
    if (!label) {
        label = document.createElement('div');
        label.id = LABEL_ID;
        label.className = 'qualiflow-root qualiflow-cssdbg-label';
        document.body.appendChild(label);
    }
    return { box, label };
}

function hideOverlay() {
    const box = document.getElementById(BOX_ID);
    const label = document.getElementById(LABEL_ID);
    if (box) box.style.display = 'none';
    if (label) label.style.display = 'none';
}

function paint() {
    rafPending = false;
    if (!enabled || suspended) return;
    const el = lastTarget;
    if (!el || !el.isConnected || isOwn(el)) { hideOverlay(); return; }
    const { box, label } = ensureOverlay();
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    box.style.cssText = `display:block;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;`;

    const info = elementLabel({ tag: el.tagName, id: el.id ? esc(el.id) : '', classes: userClasses(el) });
    const copied = Date.now() < copiedUntil;
    label.innerHTML = '';
    const l1 = document.createElement('div');
    l1.className = 'qualiflow-cssdbg-title';
    l1.textContent = info;
    const l2 = document.createElement('div');
    l2.textContent = `${formatSize(r.width, r.height)}  |  padding ${compactBox(cs.padding)}  |  margin ${compactBox(cs.margin)}`;
    const l3 = document.createElement('div');
    l3.textContent = `fonte ${cs.fontSize} ${cs.fontWeight}  |  cor ${cs.color}  |  fundo ${cs.backgroundColor}`;
    const l4 = document.createElement('div');
    l4.className = 'qualiflow-cssdbg-hint';
    l4.textContent = copied ? 'Seletor copiado' : 'Alt + clique copia o seletor';
    label.append(l1, l2, l3, l4);
    label.style.display = 'block';

    const lh = label.offsetHeight;
    const lw = label.offsetWidth;
    let top = r.top - lh - 6;
    if (top < 4) top = Math.min(window.innerHeight - lh - 4, r.bottom + 6);
    const left = Math.max(4, Math.min(window.innerWidth - lw - 4, r.left));
    label.style.left = `${left}px`;
    label.style.top = `${Math.max(4, top)}px`;
}

function schedulePaint() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(paint);
}

function onMove(e) {
    lastTarget = e.target instanceof Element ? e.target : null;
    schedulePaint();
}

async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch { /* tenta o fallback */ }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;';
    document.body.appendChild(ta);
    ta.select();
    let ok;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
}

function onClick(e) {
    if (!e.altKey || !(e.target instanceof Element) || isOwn(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    const selector = cssSelector(chainFor(e.target));
    lastTarget = e.target;
    copyText(selector).then((ok) => {
        copiedUntil = ok ? Date.now() + 1500 : 0;
        schedulePaint();
        setTimeout(schedulePaint, 1600);
    });
}

function applyStyle() {
    let style = document.getElementById(STYLE_ID);
    if (!style) {
        style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = OUTLINE_CSS;
        document.head.appendChild(style);
    }
    style.disabled = suspended;
}

export function enableCssDebug() {
    if (enabled) return;
    enabled = true;
    applyStyle();
    document.addEventListener('mousemove', onMove, { capture: true, passive: true });
    document.addEventListener('click', onClick, true);
    window.addEventListener('scroll', schedulePaint, true);
    window.addEventListener('resize', schedulePaint);
}

export function disableCssDebug() {
    if (!enabled) return;
    enabled = false;
    document.removeEventListener('mousemove', onMove, true);
    document.removeEventListener('click', onClick, true);
    window.removeEventListener('scroll', schedulePaint, true);
    window.removeEventListener('resize', schedulePaint);
    document.getElementById(STYLE_ID)?.remove();
    document.getElementById(BOX_ID)?.remove();
    document.getElementById(LABEL_ID)?.remove();
    lastTarget = null;
}

export function isCssDebugEnabled() {
    return enabled;
}

/** Esconde contornos e etiqueta temporariamente (capturas de tela/gravacao nao devem sair "riscadas"). */
export function setCssDebugSuspended(value) {
    suspended = !!value;
    if (!enabled) return;
    const style = document.getElementById(STYLE_ID);
    if (style) style.disabled = suspended;
    if (suspended) hideOverlay(); else schedulePaint();
}
