import test from 'node:test';
import assert from 'node:assert/strict';
import {
    arrowHead,
    boundsOf,
    distToSegment,
    handlesOf,
    hitTest,
    isDegenerate,
    nextMarkerNumber,
    normalizeBox,
    pickHandle,
    pickTopmost,
    resizeByHandle,
    snapAngle,
    translate
} from '../../src/domain/annotationGeometry.js';

const rect = (extra = {}) => ({ id: 1, type: 'rect', x: 10, y: 10, w: 100, h: 50, size: 2, ...extra });

test('normalizeBox corrige largura/altura negativas', () => {
    assert.deepEqual(normalizeBox({ type: 'rect', x: 100, y: 80, w: -40, h: -30 }), { type: 'rect', x: 60, y: 50, w: 40, h: 30 });
});

test('boundsOf cobre linha, pen, marker e caixa', () => {
    assert.deepEqual(boundsOf({ type: 'line', x1: 50, y1: 5, x2: 10, y2: 25 }), { x: 10, y: 5, w: 40, h: 20 });
    assert.deepEqual(boundsOf({ type: 'pen', points: [[1, 2], [5, 9], [3, 4]] }), { x: 1, y: 2, w: 4, h: 7 });
    assert.deepEqual(boundsOf({ type: 'marker', x: 20, y: 20, r: 10 }), { x: 10, y: 10, w: 20, h: 20 });
    assert.deepEqual(boundsOf(rect()), { x: 10, y: 10, w: 100, h: 50 });
});

test('distToSegment trata segmento degenerado e projecao fora do segmento', () => {
    assert.equal(distToSegment(3, 4, 0, 0, 0, 0), 5);
    assert.equal(distToSegment(20, 0, 0, 0, 10, 0), 10);
    assert.equal(distToSegment(5, 3, 0, 0, 10, 0), 3);
});

test('hitTest de retangulo vazio acerta so a borda', () => {
    assert.equal(hitTest(rect(), 10, 30, 4), true);
    assert.equal(hitTest(rect(), 60, 35, 4), false);
    assert.equal(hitTest(rect({ filled: true }), 60, 35, 4), true);
});

test('hitTest de elipse acerta o contorno e nao o centro', () => {
    const e = { id: 2, type: 'ellipse', x: 0, y: 0, w: 100, h: 100, size: 2 };
    assert.equal(hitTest(e, 50, 0, 4), true);
    assert.equal(hitTest(e, 50, 50, 4), false);
});

test('hitTest de linha, pen, texto, highlight e marker', () => {
    assert.equal(hitTest({ type: 'line', x1: 0, y1: 0, x2: 100, y2: 0, size: 2 }, 50, 3, 4), true);
    assert.equal(hitTest({ type: 'line', x1: 0, y1: 0, x2: 100, y2: 0, size: 2 }, 50, 30, 4), false);
    assert.equal(hitTest({ type: 'pen', points: [[0, 0], [50, 50]], size: 3 }, 25, 25, 4), true);
    assert.equal(hitTest({ type: 'text', x: 10, y: 10, w: 80, h: 20 }, 30, 15, 4), true);
    assert.equal(hitTest({ type: 'highlight', x: 0, y: 0, w: 50, h: 20 }, 25, 10, 4), true);
    assert.equal(hitTest({ type: 'marker', x: 50, y: 50, r: 12 }, 55, 55, 4), true);
    assert.equal(hitTest({ type: 'marker', x: 50, y: 50, r: 12 }, 90, 90, 4), false);
});

test('pickTopmost devolve o ultimo objeto sob o ponto', () => {
    const a = { id: 'a', type: 'highlight', x: 0, y: 0, w: 100, h: 100 };
    const b = { id: 'b', type: 'highlight', x: 0, y: 0, w: 100, h: 100 };
    assert.equal(pickTopmost([a, b], 50, 50).id, 'b');
    assert.equal(pickTopmost([a, b], 500, 500), null);
});

test('translate move todos os tipos sem mutar o original', () => {
    const r = rect();
    const moved = translate(r, 5, -5);
    assert.equal(moved.x, 15);
    assert.equal(r.x, 10);
    assert.deepEqual(translate({ type: 'line', x1: 0, y1: 0, x2: 10, y2: 10 }, 1, 2), { type: 'line', x1: 1, y1: 2, x2: 11, y2: 12 });
    assert.deepEqual(translate({ type: 'pen', points: [[0, 0], [1, 1]] }, 2, 2).points, [[2, 2], [3, 3]]);
});

test('alcas: 4 cantos para caixa, 2 pontas para linha, nenhuma para texto', () => {
    assert.equal(handlesOf(rect()).length, 4);
    assert.equal(handlesOf({ type: 'arrow', x1: 0, y1: 0, x2: 5, y2: 5 }).length, 2);
    assert.equal(handlesOf({ type: 'text', x: 0, y: 0, w: 5, h: 5 }).length, 0);
    assert.equal(pickHandle(rect(), 12, 11, 8).id, 'nw');
    assert.equal(pickHandle(rect(), 60, 35, 8), null);
});

test('resizeByHandle redimensiona e normaliza ao cruzar o lado oposto', () => {
    const r = resizeByHandle(rect(), 'se', 200, 100);
    assert.deepEqual([r.x, r.y, r.w, r.h], [10, 10, 190, 90]);
    const flipped = resizeByHandle(rect(), 'se', 0, 0);
    assert.deepEqual([flipped.x, flipped.y, flipped.w, flipped.h], [0, 0, 10, 10]);
    const nw = resizeByHandle(rect(), 'nw', 0, 0);
    assert.deepEqual([nw.x, nw.y, nw.w, nw.h], [0, 0, 110, 60]);
    const line = resizeByHandle({ type: 'line', x1: 0, y1: 0, x2: 10, y2: 10 }, 'p2', 40, 50);
    assert.deepEqual([line.x2, line.y2], [40, 50]);
});

test('isDegenerate descarta cliques sem arrastar e texto vazio', () => {
    assert.equal(isDegenerate({ type: 'rect', x: 0, y: 0, w: 1, h: 1 }), true);
    assert.equal(isDegenerate({ type: 'rect', x: 0, y: 0, w: 30, h: 30 }), false);
    assert.equal(isDegenerate({ type: 'line', x1: 0, y1: 0, x2: 1, y2: 1 }), true);
    assert.equal(isDegenerate({ type: 'text', text: '   ' }), true);
    assert.equal(isDegenerate({ type: 'pen', points: [[0, 0]] }), true);
});

test('nextMarkerNumber continua a numeracao existente', () => {
    assert.equal(nextMarkerNumber([]), 1);
    assert.equal(nextMarkerNumber([{ type: 'marker', n: 1 }, { type: 'rect' }, { type: 'marker', n: 4 }]), 5);
});

test('arrowHead e snapAngle', () => {
    const [tip] = arrowHead(0, 0, 100, 0, 3);
    assert.deepEqual(tip, [100, 0]);
    const s = snapAngle(0, 0, 100, 10);
    assert.ok(Math.abs(s.y) < 1e-9);
    assert.ok(Math.abs(s.x - Math.hypot(100, 10)) < 1e-9);
});
