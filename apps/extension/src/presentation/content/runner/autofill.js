/*
 * Autopreenchimento de campos de formulario com dados de teste validos.
 * Detecta CPF, CNPJ, RG, CEP, e-mail e telefone e mostra um icone sobre o campo;
 * ao clicar, gera um valor valido (formatado conforme maxlength/placeholder) e preenche.
 */
import { FIELD_KIND_LABELS, FILL_MODES, detectFieldKind, generateForField, kindSupportsMax } from '../../../domain/testData.js';

const LAYER_ID = 'qualiflow-autofill-layer';
const ICON_SIZE = 22;
const ICON_GAP = 6;
const SCAN_DEBOUNCE_MS = 150;

const WAND_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8L19 13M17.8 6.2L19 5M3 21l9-9M12.2 6.2L11 5"></path></svg>';

let enabled = false;
let suspended = false;
let layer = null;
let observer = null;
let scanTimer = null;
let rafPending = false;
/** @type {Map<HTMLInputElement|HTMLTextAreaElement, {kind: string, icon: HTMLButtonElement}>} */
const tracked = new Map();

// ---------------------------------------------------------------- deteccao

function isOwnUi(el) {
    return !!el.closest('.qualiflow-root, #qualiflow-container');
}

function isVisible(el) {
    if (!el.isConnected) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width < 40 || rect.height < 16) return false;
    const style = getComputedStyle(el);
    return style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity) !== 0;
}

function labelTextFor(el) {
    const parts = [];
    if (el.labels) {
        for (const l of el.labels) parts.push(l.textContent);
    }
    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
        labelledBy.split(/\s+/).forEach((id) => {
            const ref = document.getElementById(id);
            if (ref) parts.push(ref.textContent);
        });
    }
    // Floating labels (Material, etc.): rotulo irmao imediato do campo ou do wrapper, mas so
    // quando o campo nao tem rotulo proprio e o rotulo nao pertence a outro controle.
    if (parts.length === 0) {
        const sibling = el.previousElementSibling || el.parentElement?.previousElementSibling;
        const belongsToOther = sibling && (
            (sibling.control && sibling.control !== el) || sibling.querySelector?.('input, select, textarea')
        );
        if (sibling && sibling.tagName === 'LABEL' && !belongsToOther) parts.push(sibling.textContent);
    }
    return parts.join(' ').trim().slice(0, 120);
}

function readAttrs(el) {
    return {
        type: el.tagName === 'TEXTAREA' ? 'text' : (el.getAttribute('type') || 'text'),
        name: el.getAttribute('name'),
        id: el.id,
        placeholder: el.getAttribute('placeholder'),
        ariaLabel: el.getAttribute('aria-label'),
        autocomplete: el.getAttribute('autocomplete'),
        dataTestId: el.getAttribute('data-testid') || el.getAttribute('data-test') || el.getAttribute('data-cy'),
        labelText: labelTextFor(el),
        maxLength: el.maxLength > 0 ? el.maxLength : undefined,
        readOnly: el.readOnly,
        disabled: el.disabled
    };
}

function classify(el) {
    if (isOwnUi(el)) return null;
    return detectFieldKind(readAttrs(el));
}

// ------------------------------------------------------------- preenchimento

/** Define o valor de modo que React/Vue/Angular e mascaras JS percebam a mudanca. */
function setNativeValue(el, value) {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(el, value); else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
}

function fillField(el, kind, icon, mode = FILL_MODES.VALID) {
    const value = generateForField(kind, {
        maxLength: el.maxLength > 0 ? el.maxLength : undefined,
        placeholder: el.getAttribute('placeholder'),
        inputType: String(el.getAttribute('type') || '').toLowerCase()
    }, Math.random, mode);
    if (value === null || value === undefined) return;
    el.focus({ preventScroll: true });
    setNativeValue(el, value);
    icon.classList.add('is-done');
    setTimeout(() => icon.classList.remove('is-done'), 900);
}

// ------------------------------------------------------------------- icones

function ensureLayer() {
    if (layer && layer.isConnected) return layer;
    layer = document.createElement('div');
    layer.id = LAYER_ID;
    layer.className = 'qualiflow-root qualiflow-autofill-layer';
    layer.style.display = suspended ? 'none' : '';
    document.body.appendChild(layer);
    return layer;
}

let openMenu = null;

function closeFillMenu() {
    if (!openMenu) return;
    document.removeEventListener('mousedown', openMenu.onOutside, true);
    document.removeEventListener('keydown', openMenu.onKey, true);
    openMenu.menu.remove();
    openMenu = null;
}

/** Menu do icone: valor valido, invalido (teste negativo) e tamanho maximo (texto livre com maxlength). */
function openFillMenu(el, kind, icon) {
    closeFillMenu();
    const menu = document.createElement('div');
    menu.className = 'qualiflow-autofill-menu';
    menu.setAttribute('role', 'menu');
    const maxLen = el.maxLength > 0 ? el.maxLength : 0;
    const items = [
        { mode: FILL_MODES.VALID, text: `Valor válido (${FIELD_KIND_LABELS[kind]})` },
        { mode: FILL_MODES.INVALID, text: 'Valor inválido (teste negativo)' }
    ];
    if (kindSupportsMax(kind, maxLen)) items.push({ mode: FILL_MODES.MAX, text: `Tamanho máximo (${maxLen} caracteres)` });
    items.forEach((item) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('role', 'menuitem');
        b.textContent = item.text;
        b.addEventListener('mousedown', (e) => e.preventDefault());
        b.addEventListener('click', (e) => {
            e.stopPropagation();
            closeFillMenu();
            fillField(el, kind, icon, item.mode);
        });
        menu.appendChild(b);
    });
    ensureLayer().appendChild(menu);
    const r = icon.getBoundingClientRect();
    menu.style.left = `${Math.max(4, Math.min(window.innerWidth - 240, r.right - 230))}px`;
    menu.style.top = `${Math.min(window.innerHeight - 110, r.bottom + 4)}px`;
    const onOutside = (e) => { if (!menu.contains(e.target)) closeFillMenu(); };
    const onKey = (e) => { if (e.key === 'Escape') closeFillMenu(); };
    document.addEventListener('mousedown', onOutside, true);
    document.addEventListener('keydown', onKey, true);
    openMenu = { menu, onOutside, onKey };
    menu.querySelector('button')?.focus();
}

function createIcon(el, kind) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'qualiflow-autofill-icon';
    const label = FIELD_KIND_LABELS[kind];
    btn.title = `Preencher ${label} válido (Shift+clique ou botão direito: mais opções)`;
    btn.setAttribute('aria-label', `Preencher ${label} válido. Shift+clique ou botão direito abre mais opções`);
    btn.setAttribute('aria-haspopup', 'menu');
    btn.innerHTML = WAND_SVG;
    // mousedown evita que o campo perca o foco antes do clique
    btn.addEventListener('mousedown', (e) => e.preventDefault());
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (suspended) return;
        if (e.shiftKey) { openFillMenu(el, kind, btn); return; }
        fillField(el, kind, btn);
    });
    btn.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!suspended) openFillMenu(el, kind, btn);
    });
    ensureLayer().appendChild(btn);
    return btn;
}

function positionIcon(el, icon) {
    const rect = el.getBoundingClientRect();
    const inViewport = rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth;
    if (!inViewport || !isVisible(el)) {
        icon.style.display = 'none';
        return;
    }
    icon.style.display = '';
    const top = rect.top + (rect.height - ICON_SIZE) / 2;
    const left = rect.right - ICON_SIZE - ICON_GAP;
    icon.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
}

function repositionAll() {
    rafPending = false;
    for (const [el, entry] of tracked) {
        if (!el.isConnected) {
            entry.icon.remove();
            tracked.delete(el);
            continue;
        }
        positionIcon(el, entry.icon);
    }
}

function scheduleReposition() {
    if (rafPending || !enabled) return;
    rafPending = true;
    requestAnimationFrame(repositionAll);
}

function scan() {
    scanTimer = null;
    if (!enabled) return;
    const fields = document.querySelectorAll('input, textarea');
    const seen = new Set();
    fields.forEach((el) => {
        const kind = classify(el);
        if (!kind) return;
        seen.add(el);
        const existing = tracked.get(el);
        if (existing && existing.kind === kind) return;
        if (existing) existing.icon.remove();
        tracked.set(el, { kind, icon: createIcon(el, kind) });
    });
    for (const [el, entry] of tracked) {
        if (!seen.has(el)) {
            entry.icon.remove();
            tracked.delete(el);
        }
    }
    repositionAll();
}

function scheduleScan() {
    if (scanTimer || !enabled) return;
    scanTimer = setTimeout(scan, SCAN_DEBOUNCE_MS);
}

// ------------------------------------------------------------------ ciclo

function isRelevantMutation(records) {
    return records.some((r) => {
        if (r.type === 'attributes') return !isOwnUi(r.target);
        return [...r.addedNodes, ...r.removedNodes].some((n) => !(n.nodeType === 1 && n.closest?.('.qualiflow-root')));
    });
}

export function startAutofill() {
    if (enabled) return;
    enabled = true;
    ensureLayer();
    observer = new MutationObserver((records) => {
        if (isRelevantMutation(records)) scheduleScan();
    });
    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['type', 'name', 'id', 'placeholder', 'disabled', 'readonly', 'style', 'class', 'hidden']
    });
    window.addEventListener('scroll', scheduleReposition, true);
    window.addEventListener('resize', scheduleReposition);
    document.addEventListener('focusin', scheduleScan);
    scan();
}

export function stopAutofill() {
    if (!enabled) return;
    enabled = false;
    observer?.disconnect();
    observer = null;
    clearTimeout(scanTimer);
    scanTimer = null;
    window.removeEventListener('scroll', scheduleReposition, true);
    window.removeEventListener('resize', scheduleReposition);
    document.removeEventListener('focusin', scheduleScan);
    tracked.clear();
    closeFillMenu();
    layer?.remove();
    layer = null;
}

export function isAutofillEnabled() {
    return enabled;
}

/** Esconde os icones (e bloqueia o preenchimento) sem desligar a deteccao, ex.: teste pausado. */
export function setAutofillSuspended(value) {
    suspended = !!value;
    if (layer) layer.style.display = suspended ? 'none' : '';
}
