import test from 'node:test';
import assert from 'node:assert/strict';
import { VIEWPORT_PRESETS, appendPerfEntry, shouldShiftFixed, summarizePerfLog, summarizeStyles } from '../../src/domain/uiInsights.js';

test('presets de responsividade: celular e tablet emulam toque, todos com tamanho valido', () => {
    assert.deepEqual(VIEWPORT_PRESETS.map((p) => p.key), ['mobile', 'tablet', 'laptop', 'desktop']);
    assert.ok(VIEWPORT_PRESETS.every((p) => p.width >= 200 && p.height >= 200));
    assert.equal(VIEWPORT_PRESETS.find((p) => p.key === 'mobile').mobile, true);
    assert.equal(VIEWPORT_PRESETS.find((p) => p.key === 'desktop').mobile, undefined);
});

test('summarizeStyles agrupa fontes, tamanhos e cores por uso', () => {
    const r = summarizeStyles([
        { fontFamily: '"Segoe UI", Arial', fontSize: '14px', fontWeight: '400', color: 'rgb(0, 0, 0)', background: 'rgba(0, 0, 0, 0)' },
        { fontFamily: 'Segoe UI, sans-serif', fontSize: '14px', fontWeight: '400', color: 'rgb(0, 0, 0)', background: 'rgb(255, 255, 255)' },
        { fontFamily: 'Arial', fontSize: '20px', fontWeight: '700', color: '#336699', background: 'rgb(255, 255, 255)' }
    ]);
    assert.deepEqual(r.fonts[0], { value: 'Segoe UI 400', count: 2 });
    assert.deepEqual(r.sizes[0], { value: '14px', count: 2 });
    assert.equal(r.textColors[0].value, '#000000');
    assert.deepEqual(r.backgroundColors, [{ value: '#ffffff', count: 2 }]); // transparente e ignorado
});

test('historico de desempenho: mais recente primeiro, limitado, com mediana', () => {
    let log = [];
    for (let i = 1; i <= 5; i += 1) log = appendPerfEntry(log, { lcp: i * 100, ttfb: 50, fcp: null, load: 10 }, 3);
    assert.equal(log.length, 3);
    assert.equal(log[0].lcp, 500);
    const s = summarizePerfLog(log);
    assert.equal(s.lcp, 400);
    assert.equal(s.fcp, null);
    assert.equal(summarizePerfLog(undefined).count, 0);
});

test('shouldShiftFixed: so desloca fixos que invadem a faixa do runner', () => {
    const base = { position: 'fixed', viewportWidth: 1400, dockWidth: 420 };
    assert.equal(shouldShiftFixed({ ...base, rect: { left: 1100, right: 1400, width: 300, height: 40 } }), true);
    assert.equal(shouldShiftFixed({ ...base, rect: { left: 10, right: 500, width: 490, height: 40 } }), false);
    assert.equal(shouldShiftFixed({ ...base, rect: { left: 0, right: 1400, width: 1400, height: 48 } }), false); // barra de largura total
    assert.equal(shouldShiftFixed({ ...base, position: 'absolute', rect: { left: 1100, right: 1400, width: 300, height: 40 } }), false);
    assert.equal(shouldShiftFixed({ ...base, rect: { left: 1100, right: 1400, width: 0, height: 0 } }), false);
});
