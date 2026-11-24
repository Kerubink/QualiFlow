/*
 * Ferramentas de QA de interface (DOM): regua, overlay de design, checagem rapida de acessibilidade e
 * metricas de desempenho. Calculos puros em domain/uiChecks.js.
 */
import { checkContrast, composite, parseCssColor } from '../../../domain/uiChecks.js';
import { selectorFor } from './cssDebug.js';

const own = (el) => !!el.closest('.qualiflow-root');

// ------------------------------------------------------------------ regua
let ruler = null;

export function isRulerOn() {
    return !!ruler;
}

export function stopRuler() {
    if (!ruler) return;
    document.removeEventListener('keydown', ruler.onKey, true);
    ruler.layer.remove();
    ruler = null;
}

export function startRuler() {
    if (ruler) return;
    const layer = document.createElement('div');
    layer.id = 'qualiflow-ruler';
    layer.className = 'qualiflow-root qualiflow-ruler';
    layer.innerHTML = '<div class="qualiflow-ruler-hint">Arraste para medir. Esc encerra a régua.</div><div class="qualiflow-ruler-rect" hidden></div><div class="qualiflow-ruler-label" hidden></div>';
    document.body.appendChild(layer);
    const rect = layer.querySelector('.qualiflow-ruler-rect');
    const label = layer.querySelector('.qualiflow-ruler-label');
    let start = null;

    const draw = (x2, y2) => {
        const x = Math.min(start.x, x2);
        const y = Math.min(start.y, y2);
        const w = Math.abs(x2 - start.x);
        const h = Math.abs(y2 - start.y);
        rect.hidden = false;
        rect.style.cssText = `left:${x}px;top:${y}px;width:${w}px;height:${h}px;`;
        label.hidden = false;
        label.textContent = `${Math.round(w)} x ${Math.round(h)} px  |  diagonal ${Math.round(Math.hypot(w, h))} px`;
        label.style.left = `${Math.min(x, window.innerWidth - 240)}px`;
        label.style.top = `${Math.max(4, y - 28)}px`;
    };
    layer.addEventListener('pointerdown', (e) => { start = { x: e.clientX, y: e.clientY }; draw(e.clientX, e.clientY); });
    layer.addEventListener('pointermove', (e) => { if (start) draw(e.clientX, e.clientY); });
    layer.addEventListener('pointerup', () => { start = null; });
    const onKey = (e) => { if (e.key === 'Escape') { stopRuler(); document.dispatchEvent(new CustomEvent('qualiflow:tools-changed')); } };
    document.addEventListener('keydown', onKey, true);
    ruler = { layer, onKey };
}

// ----------------------------------------------------------- conta-gotas
export async function pickScreenColor() {
    if (!('EyeDropper' in window)) throw new Error('O conta-gotas não está disponível neste navegador.');
    try {
        const result = await new window.EyeDropper().open();
        return result.sRGBHex;
    } catch {
        return null; // cancelado (Esc)
    }
}

// ------------------------------------------------------- overlay de design
let design = null;

export function isDesignOverlayOn() {
    return !!design;
}

export function closeDesignOverlay() {
    if (!design) return;
    design.img.remove();
    design.panel.remove();
    design = null;
    document.dispatchEvent(new CustomEvent('qualiflow:tools-changed'));
}

export function openDesignOverlay(dataUrl) {
    closeDesignOverlay();
    const img = document.createElement('img');
    img.id = 'qualiflow-design-overlay';
    img.className = 'qualiflow-root qualiflow-design-img';
    img.alt = '';
    img.src = dataUrl;
    img.style.opacity = '0.5';
    document.body.appendChild(img);

    const panel = document.createElement('div');
    panel.id = 'qualiflow-design-controls';
    panel.className = 'qualiflow-root qualiflow-design-panel';
    panel.innerHTML = `
        <strong>Overlay de design</strong>
        <label>Opacidade <input type="range" id="qf-dz-opacity" min="10" max="90" value="50"></label>
        <label>Escala <input type="range" id="qf-dz-scale" min="25" max="200" value="100"></label>
        <label><input type="checkbox" id="qf-dz-move"> Mover</label>
        <button type="button" id="qf-dz-remove" class="qualiflow-hub-btn">Remover</button>`;
    document.body.appendChild(panel);

    let natural = 0;
    img.addEventListener('load', () => { natural = img.naturalWidth; applyScale(); });
    const applyScale = () => { if (natural) img.style.width = `${natural * Number(panel.querySelector('#qf-dz-scale').value) / 100}px`; };
    panel.querySelector('#qf-dz-opacity').addEventListener('input', (e) => { img.style.opacity = String(e.target.value / 100); });
    panel.querySelector('#qf-dz-scale').addEventListener('input', applyScale);
    panel.querySelector('#qf-dz-move').addEventListener('change', (e) => { img.classList.toggle('is-movable', e.target.checked); });
    panel.querySelector('#qf-dz-remove').addEventListener('click', closeDesignOverlay);

    let drag = null;
    img.addEventListener('pointerdown', (e) => {
        if (!img.classList.contains('is-movable')) return;
        drag = { x: e.clientX, y: e.clientY, left: img.offsetLeft, top: img.offsetTop };
        try { img.setPointerCapture(e.pointerId); } catch { /* sintetico */ }
    });
    img.addEventListener('pointermove', (e) => {
        if (!drag) return;
        img.style.left = `${drag.left + e.clientX - drag.x}px`;
        img.style.top = `${drag.top + e.clientY - drag.y}px`;
    });
    img.addEventListener('pointerup', () => { drag = null; });
    design = { img, panel };
}

export function pickDesignImageFile() {
    return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.style.display = 'none';
        input.addEventListener('change', () => {
            const file = input.files && input.files[0];
            input.remove();
            if (!file) { resolve(null); return; }
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(file);
        });
        input.addEventListener('cancel', () => { input.remove(); resolve(null); });
        document.body.appendChild(input);
        input.click();
    });
}

// ---------------------------------------------------------- destaque de elemento
let hlTimer = null;

export function highlightElement(el) {
    if (!el || !el.isConnected) return;
    el.scrollIntoView({ block: 'center', inline: 'nearest' });
    let box = document.getElementById('qualiflow-hl-box');
    if (!box) {
        box = document.createElement('div');
        box.id = 'qualiflow-hl-box';
        box.className = 'qualiflow-root qualiflow-hl-box';
        document.body.appendChild(box);
    }
    const place = () => {
        const r = el.getBoundingClientRect();
        box.style.cssText = `display:block;left:${r.left - 3}px;top:${r.top - 3}px;width:${r.width + 6}px;height:${r.height + 6}px;`;
    };
    place();
    setTimeout(place, 350); // depois do scroll suave/ajustes
    clearTimeout(hlTimer);
    hlTimer = setTimeout(() => box.remove(), 3000);
}

// --------------------------------------------------------- acessibilidade
const RULE_ORDER = ['html-lang', 'img-alt', 'input-label', 'button-name', 'link-name', 'contrast'];
const MAX_ISSUES = 200;
const MAX_TEXT_NODES = 1500;

function visible(el) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    const s = getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none';
}

function hasText(el) {
    return !!(el.textContent || '').trim();
}

function accessibleName(el) {
    if (el.getAttribute('aria-label')?.trim() || el.getAttribute('title')?.trim() || el.value?.trim?.()) return true;
    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy && labelledBy.split(/\s+/).some((id) => (document.getElementById(id)?.textContent || '').trim())) return true;
    if (hasText(el)) return true;
    if (el.querySelector('img[alt]:not([alt=""]), svg title, [aria-label]')) return true;
    return false;
}

function effectiveBackground(el) {
    const layers = [];
    for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
        const c = parseCssColor(getComputedStyle(node).backgroundColor);
        if (c && c.a > 0) {
            layers.push(c);
            if (c.a >= 1) break;
        }
    }
    let base = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = layers.length - 1; i >= 0; i--) base = composite(layers[i], base);
    return base;
}

export function scanAccessibility() {
    const issues = [];
    const push = (rule, label, el, detail = '') => {
        if (issues.length >= MAX_ISSUES) return;
        issues.push({ rule, label, el, selector: selectorFor(el), detail });
    };
    if (!document.documentElement.getAttribute('lang')) push('html-lang', 'Documento sem atributo lang', document.documentElement);

    document.querySelectorAll('img').forEach((img) => {
        if (own(img) || !visible(img)) return;
        if (!img.hasAttribute('alt') && img.getAttribute('role') !== 'presentation' && img.getAttribute('aria-hidden') !== 'true') {
            push('img-alt', 'Imagem sem texto alternativo (alt)', img);
        }
    });
    document.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]):not([type=image]), select, textarea').forEach((el) => {
        if (own(el) || !visible(el)) return;
        const labelled = (el.labels && el.labels.length) || el.getAttribute('aria-label')?.trim() || el.getAttribute('aria-labelledby') || el.getAttribute('title')?.trim();
        if (!labelled) push('input-label', 'Campo sem rótulo associado', el);
    });
    document.querySelectorAll('button, [role=button], input[type=submit], input[type=button]').forEach((el) => {
        if (own(el) || !visible(el)) return;
        if (!accessibleName(el)) push('button-name', 'Botão sem nome acessível', el);
    });
    document.querySelectorAll('a[href]').forEach((el) => {
        if (own(el) || !visible(el)) return;
        if (!accessibleName(el)) push('link-name', 'Link sem nome acessível', el);
    });

    // contraste do texto (nao considera imagens/gradientes de fundo)
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const checked = new Set();
    let n = 0;
    while (walker.nextNode() && n < MAX_TEXT_NODES) {
        n += 1;
        const node = walker.currentNode;
        if (!node.nodeValue.trim()) continue;
        const el = node.parentElement;
        if (!el || checked.has(el) || own(el) || ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(el.tagName) || !visible(el)) continue;
        checked.add(el);
        const cs = getComputedStyle(el);
        const result = checkContrast({
            fg: cs.color,
            bg: effectiveBackground(el),
            fontPx: parseFloat(cs.fontSize),
            bold: Number(cs.fontWeight) >= 700 || cs.fontWeight === 'bold'
        });
        if (result && !result.pass) push('contrast', `Contraste ${result.ratio}:1 (mínimo ${result.required}:1)`, el, `${cs.color} sobre fundo`);
    }

    const counts = {};
    issues.forEach((i) => { counts[i.rule] = (counts[i.rule] || 0) + 1; });
    issues.sort((a, b) => RULE_ORDER.indexOf(a.rule) - RULE_ORDER.indexOf(b.rule));
    return { issues, counts, scannedAt: Date.now() };
}

// --------------------------------------------------------------- desempenho
const vitals = { lcp: null, cls: 0 };
let observing = false;

/** Observadores de LCP e CLS (iniciam junto do runner; usam buffer para pegar o que ja ocorreu). */
export function initPerfObservers() {
    if (observing || typeof PerformanceObserver === 'undefined') return;
    observing = true;
    try {
        new PerformanceObserver((list) => {
            const entries = list.getEntries();
            if (entries.length) vitals.lcp = entries[entries.length - 1].startTime;
        }).observe({ type: 'largest-contentful-paint', buffered: true });
    } catch { /* tipo nao suportado */ }
    try {
        new PerformanceObserver((list) => {
            list.getEntries().forEach((e) => { if (!e.hadRecentInput) vitals.cls += e.value; });
        }).observe({ type: 'layout-shift', buffered: true });
    } catch { /* tipo nao suportado */ }
}

export function collectPerformance() {
    const nav = performance.getEntriesByType('navigation')[0];
    const fcp = performance.getEntriesByName('first-contentful-paint')[0];
    const resources = performance.getEntriesByType('resource');
    return {
        ttfb: nav ? nav.responseStart : null,
        domContentLoaded: nav ? nav.domContentLoadedEventEnd : null,
        load: nav && nav.loadEventEnd > 0 ? nav.loadEventEnd : null,
        fcp: fcp ? fcp.startTime : null,
        lcp: vitals.lcp,
        cls: vitals.cls,
        resources: resources.length,
        transfer: resources.reduce((sum, r) => sum + (r.transferSize || 0), 0)
    };
}
