/*
 * Rotulos e seletores do depurador CSS. Modulo PURO: a camada de apresentacao le o DOM e
 * passa dados simples (tag, id, classes ja escapados).
 */

/** "div#id.a.b" (no maximo `maxClasses` classes). */
export function elementLabel({ tag = 'div', id = '', classes = [] } = {}, maxClasses = 3) {
    const cls = classes.slice(0, maxClasses).map((c) => `.${c}`).join('');
    const extra = classes.length > maxClasses ? `+${classes.length - maxClasses}` : '';
    return `${tag.toLowerCase()}${id ? `#${id}` : ''}${cls}${extra}`;
}

/**
 * Seletor CSS a partir da cadeia raiz -> elemento. Para ao achar um id.
 * Cada no: { tag, id, classes, nth } onde nth = posicao entre irmaos de mesma tag
 * (so informado quando ha mais de um irmao com a mesma tag).
 */
export function cssSelector(chain = []) {
    const parts = [];
    for (let i = chain.length - 1; i >= 0; i--) {
        const n = chain[i];
        const tag = n.tag.toLowerCase();
        if (n.id) { parts.unshift(`${tag}#${n.id}`); break; }
        const cls = (n.classes || []).slice(0, 2).map((c) => `.${c}`).join('');
        const nth = n.nth ? `:nth-of-type(${n.nth})` : '';
        parts.unshift(`${tag}${cls}${nth}`);
    }
    return parts.join(' > ');
}

/** "320 x 48" arredondado. */
export function formatSize(width, height) {
    return `${Math.round(width)} x ${Math.round(height)}`;
}

/** "8 16 8 16" -> "8 16" quando simetrico; entrada no formato "8px 16px 8px 16px". */
export function compactBox(value = '') {
    const nums = String(value).split(/\s+/).map((v) => parseFloat(v)).filter((n) => Number.isFinite(n));
    if (nums.length !== 4) return String(value);
    const [t, r, b, l] = nums.map((n) => Math.round(n));
    if (t === r && r === b && b === l) return String(t);
    if (t === b && r === l) return `${t} ${r}`;
    return `${t} ${r} ${b} ${l}`;
}
