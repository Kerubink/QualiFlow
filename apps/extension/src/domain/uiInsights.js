// Regras puras das ferramentas de UI/UX: resumo de fontes/cores, historico de desempenho, presets de
// responsividade e decisao de deslocar elementos fixos quando o runner esta ancorado.
import { parseCssColor, rgbToHex } from './uiChecks.js';

export const VIEWPORT_PRESETS = Object.freeze([
    { key: 'mobile', label: 'Celular', width: 375, height: 812, mobile: true },
    { key: 'tablet', label: 'Tablet', width: 768, height: 1024, mobile: true },
    { key: 'laptop', label: 'Notebook', width: 1280, height: 800 },
    { key: 'desktop', label: 'Desktop', width: 1920, height: 1080 }
]);

const bump = (map, key) => map.set(key, (map.get(key) || 0) + 1);
const ranked = (map, limit) => [...map.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))).slice(0, limit);

const firstFamily = (value) => String(value || '').split(',')[0].replace(/["']/g, '').trim();

/**
 * Resume amostras de estilo computado ({ fontFamily, fontSize, fontWeight, color, background }) em
 * fontes, tamanhos, cores de texto e cores de fundo, ordenados por uso.
 */
export function summarizeStyles(samples, { limit = 12 } = {}) {
    const fonts = new Map();
    const sizes = new Map();
    const text = new Map();
    const backgrounds = new Map();
    for (const s of samples || []) {
        const family = firstFamily(s.fontFamily);
        if (family) bump(fonts, `${family} ${Number(s.fontWeight) || 400}`);
        const size = parseFloat(s.fontSize);
        if (Number.isFinite(size) && size > 0) bump(sizes, `${Math.round(size * 10) / 10}px`);
        const fg = parseCssColor(s.color);
        if (fg && fg.a > 0) bump(text, rgbToHex(fg));
        const bg = parseCssColor(s.background);
        if (bg && bg.a >= 0.5) bump(backgrounds, rgbToHex(bg));
    }
    const pick = (map) => ranked(map, limit).map(([value, count]) => ({ value, count }));
    return { fonts: pick(fonts), sizes: pick(sizes), textColors: pick(text), backgroundColors: pick(backgrounds) };
}

/** Acrescenta uma medicao ao historico (mais recente primeiro), limitado a `max` entradas. */
export function appendPerfEntry(log, entry, max = 30) {
    return [entry, ...(Array.isArray(log) ? log : [])].slice(0, max);
}

const median = (values) => {
    const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
    if (!v.length) return null;
    const mid = Math.floor(v.length / 2);
    return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
};

/** Mediana das metricas do historico (robusta a uma carga fora do normal). */
export function summarizePerfLog(log) {
    const list = Array.isArray(log) ? log : [];
    return {
        count: list.length,
        ttfb: median(list.map((e) => e.ttfb)),
        fcp: median(list.map((e) => e.fcp)),
        lcp: median(list.map((e) => e.lcp)),
        load: median(list.map((e) => e.load))
    };
}

/**
 * Um elemento `position: fixed` encostado na borda direita (ou que invade a faixa do runner ancorado) precisa
 * ser deslocado para nao ficar por baixo dele. `rect` = posicao visivel; `rightPx` = valor computado de `right`.
 */
export function shouldShiftFixed({ position, rect, viewportWidth, dockWidth }) {
    if (position !== 'fixed' || !rect || !(dockWidth > 0)) return false;
    if (rect.width <= 0 || rect.height <= 0) return false;
    const free = viewportWidth - dockWidth;
    if (rect.right <= free + 0.5) return false; // ja esta fora da faixa do runner
    if (rect.left >= free) return true; // esta inteiro dentro da faixa
    // atravessa a faixa: so desloca se for estreito (menu, toast); barras de largura total sao ajustadas pelo layout
    return rect.width < viewportWidth * 0.6;
}
