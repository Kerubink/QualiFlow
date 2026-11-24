/*
 * Geometria pura do editor de anotacoes (sem DOM/canvas).
 * Formas suportadas:
 *   line | arrow         -> { x1, y1, x2, y2 }
 *   rect | ellipse | highlight | blur -> { x, y, w, h }
 *   pen                  -> { points: [[x, y], ...] }
 *   text                 -> { x, y, w, h }   (w/h medidos pelo renderizador)
 *   marker               -> { x, y, r }      (centro e raio)
 * Todas tem { id, type, color, size }.
 */

export const BOX_TYPES = Object.freeze(['rect', 'ellipse', 'highlight', 'blur']);
export const LINE_TYPES = Object.freeze(['line', 'arrow']);

export const isBox = (o) => BOX_TYPES.includes(o.type);
export const isLine = (o) => LINE_TYPES.includes(o.type);

/** Garante w/h positivos em formas de caixa (usuario pode arrastar para qualquer direcao). */
export function normalizeBox(o) {
    if (!isBox(o)) return o;
    const x = o.w < 0 ? o.x + o.w : o.x;
    const y = o.h < 0 ? o.y + o.h : o.y;
    return { ...o, x, y, w: Math.abs(o.w), h: Math.abs(o.h) };
}

export function boundsOf(o) {
    if (isLine(o)) {
        const x = Math.min(o.x1, o.x2);
        const y = Math.min(o.y1, o.y2);
        return { x, y, w: Math.abs(o.x2 - o.x1), h: Math.abs(o.y2 - o.y1) };
    }
    if (o.type === 'pen') {
        const xs = o.points.map((p) => p[0]);
        const ys = o.points.map((p) => p[1]);
        const x = Math.min(...xs);
        const y = Math.min(...ys);
        return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
    }
    if (o.type === 'marker') return { x: o.x - o.r, y: o.y - o.r, w: o.r * 2, h: o.r * 2 };
    const n = normalizeBox(o);
    return { x: n.x, y: n.y, w: n.w, h: n.h };
}

export function distToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function insideBox(b, px, py, pad = 0) {
    return px >= b.x - pad && px <= b.x + b.w + pad && py >= b.y - pad && py <= b.y + b.h + pad;
}

/** tol: tolerancia em pixels da imagem (o chamador converte do zoom). */
export function hitTest(o, px, py, tol = 6) {
    const reach = tol + (o.size || 1) / 2;
    if (isLine(o)) return distToSegment(px, py, o.x1, o.y1, o.x2, o.y2) <= reach;
    if (o.type === 'pen') {
        for (let i = 1; i < o.points.length; i++) {
            const a = o.points[i - 1];
            const b = o.points[i];
            if (distToSegment(px, py, a[0], a[1], b[0], b[1]) <= reach) return true;
        }
        return o.points.length === 1 && Math.hypot(px - o.points[0][0], py - o.points[0][1]) <= reach;
    }
    if (o.type === 'marker') return Math.hypot(px - o.x, py - o.y) <= o.r + tol;
    const b = boundsOf(o);
    if (o.type === 'text' || o.type === 'highlight' || o.type === 'blur' || o.filled) return insideBox(b, px, py, tol);
    if (o.type === 'ellipse') {
        const cx = b.x + b.w / 2;
        const cy = b.y + b.h / 2;
        const rx = b.w / 2 + reach;
        const ry = b.h / 2 + reach;
        if (rx <= 0 || ry <= 0) return false;
        const outer = ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 <= 1;
        const irx = Math.max(0, b.w / 2 - reach);
        const iry = Math.max(0, b.h / 2 - reach);
        const inner = irx > 0 && iry > 0 && ((px - cx) / irx) ** 2 + ((py - cy) / iry) ** 2 < 1;
        return outer && !inner;
    }
    // rect sem preenchimento: so a borda
    return insideBox(b, px, py, reach) && !insideBox(b, px, py, -reach);
}

/** Retorna o objeto mais acima (ultimo da lista) sob o ponto, ou null. */
export function pickTopmost(objects, px, py, tol = 6) {
    for (let i = objects.length - 1; i >= 0; i--) {
        if (hitTest(objects[i], px, py, tol)) return objects[i];
    }
    return null;
}

export function translate(o, dx, dy) {
    if (isLine(o)) return { ...o, x1: o.x1 + dx, y1: o.y1 + dy, x2: o.x2 + dx, y2: o.y2 + dy };
    if (o.type === 'pen') return { ...o, points: o.points.map(([x, y]) => [x + dx, y + dy]) };
    return { ...o, x: o.x + dx, y: o.y + dy };
}

/** Alcas de redimensionamento (em coordenadas da imagem). */
export function handlesOf(o) {
    if (isLine(o)) return [{ id: 'p1', x: o.x1, y: o.y1 }, { id: 'p2', x: o.x2, y: o.y2 }];
    if (isBox(o)) {
        const b = boundsOf(o);
        return [
            { id: 'nw', x: b.x, y: b.y },
            { id: 'ne', x: b.x + b.w, y: b.y },
            { id: 'sw', x: b.x, y: b.y + b.h },
            { id: 'se', x: b.x + b.w, y: b.y + b.h }
        ];
    }
    return [];
}

export function pickHandle(o, px, py, tol = 8) {
    return handlesOf(o).find((h) => Math.hypot(px - h.x, py - h.y) <= tol) || null;
}

export function resizeByHandle(o, handleId, px, py) {
    if (isLine(o)) {
        return handleId === 'p1' ? { ...o, x1: px, y1: py } : { ...o, x2: px, y2: py };
    }
    if (isBox(o)) {
        const b = boundsOf(o);
        let left = b.x;
        let top = b.y;
        let right = b.x + b.w;
        let bottom = b.y + b.h;
        if (handleId.includes('w')) left = px;
        if (handleId.includes('e')) right = px;
        if (handleId.startsWith('n')) top = py;
        if (handleId.startsWith('s')) bottom = py;
        return normalizeBox({ ...o, x: left, y: top, w: right - left, h: bottom - top });
    }
    return o;
}

/** Descarta objetos sem area/comprimento util (clique sem arrastar). */
export function isDegenerate(o, minSize = 3) {
    if (isLine(o)) return Math.hypot(o.x2 - o.x1, o.y2 - o.y1) < minSize;
    if (isBox(o)) return Math.abs(o.w) < minSize || Math.abs(o.h) < minSize;
    if (o.type === 'pen') return o.points.length < 2;
    if (o.type === 'text') return !String(o.text || '').trim();
    return false;
}

/** Proximo numero de marcador = maior existente + 1. */
export function nextMarkerNumber(objects) {
    return objects.reduce((max, o) => (o.type === 'marker' ? Math.max(max, o.n) : max), 0) + 1;
}

/** Pontos da cabeca da seta: [ponta, ladoA, ladoB]. */
export function arrowHead(x1, y1, x2, y2, size = 3) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const len = Math.max(12, size * 4.5);
    const spread = 0.45;
    return [
        [x2, y2],
        [x2 - len * Math.cos(angle - spread), y2 - len * Math.sin(angle - spread)],
        [x2 - len * Math.cos(angle + spread), y2 - len * Math.sin(angle + spread)]
    ];
}

/** Ajusta angulo para multiplos de 45 graus (Shift ao desenhar linha/seta). */
export function snapAngle(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.hypot(dx, dy);
    const step = Math.PI / 4;
    const angle = Math.round(Math.atan2(dy, dx) / step) * step;
    return { x: x1 + dist * Math.cos(angle), y: y1 + dist * Math.sin(angle) };
}
