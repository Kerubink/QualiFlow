/* Calculos das checagens rapidas de acessibilidade e desempenho do HUB. Modulo PURO. */

export function parseCssColor(input) {
    const s = String(input || '').trim().toLowerCase();
    if (!s || s === 'transparent') return s === 'transparent' ? { r: 0, g: 0, b: 0, a: 0 } : null;
    let m = /^#([0-9a-f]{3,8})$/.exec(s);
    if (m) {
        let h = m[1];
        if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('');
        if (h.length !== 6 && h.length !== 8) return null;
        return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1 };
    }
    m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(s);
    if (!m) return null;
    let a = 1;
    if (m[4] !== undefined) a = m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]), a: Math.max(0, Math.min(1, a)) };
}

/** Compoe `fg` (com alfa) sobre `bg` opaco. */
export function composite(fg, bg) {
    const a = fg.a ?? 1;
    return { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a), a: 1 };
}

export function relativeLuminance({ r, g, b }) {
    const ch = [r, g, b].map((v) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

export function contrastRatio(c1, c2) {
    const l1 = relativeLuminance(c1);
    const l2 = relativeLuminance(c2);
    const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
    return (hi + 0.05) / (lo + 0.05);
}

/** WCAG AA: texto grande (>= 24px, ou >= 18.66px em negrito) exige 3:1; demais 4.5:1. */
export function requiredContrast(fontPx, bold) {
    return fontPx >= 24 || (bold && fontPx >= 18.66) ? 3 : 4.5;
}

export function checkContrast({ fg, bg, fontPx, bold }) {
    const f = typeof fg === 'string' ? parseCssColor(fg) : fg;
    const b = typeof bg === 'string' ? parseCssColor(bg) : bg;
    if (!f || !b) return null;
    const solidBg = b.a < 1 ? composite(b, { r: 255, g: 255, b: 255, a: 1 }) : b;
    const ratio = contrastRatio(composite(f, solidBg), solidBg);
    const required = requiredContrast(fontPx, bold);
    return { ratio: Math.round(ratio * 100) / 100, required, pass: ratio >= required };
}

const THRESHOLDS = {
    LCP: [2500, 4000], FCP: [1800, 3000], CLS: [0.1, 0.25], TTFB: [800, 1800], INP: [200, 500]
};

/** Classificacao Core Web Vitals: 'good' | 'needs-improvement' | 'poor' (null se metrica desconhecida/sem valor). */
export function rateMetric(name, value) {
    const t = THRESHOLDS[name];
    if (!t || !Number.isFinite(value)) return null;
    if (value <= t[0]) return 'good';
    return value <= t[1] ? 'needs-improvement' : 'poor';
}

export function breakpointName(width) {
    if (width < 576) return 'xs (< 576)';
    if (width < 768) return 'sm (576-767)';
    if (width < 992) return 'md (768-991)';
    if (width < 1200) return 'lg (992-1199)';
    if (width < 1400) return 'xl (1200-1399)';
    return 'xxl (>= 1400)';
}

export function formatBytes(n) {
    if (!Number.isFinite(n) || n < 0) return '--';
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function rgbToHex({ r, g, b }) {
    return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
}
