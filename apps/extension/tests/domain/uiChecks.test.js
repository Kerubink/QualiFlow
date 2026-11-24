import test from 'node:test';
import assert from 'node:assert/strict';
import { breakpointName, checkContrast, composite, contrastRatio, formatBytes, parseCssColor, rateMetric, requiredContrast, rgbToHex } from '../../src/domain/uiChecks.js';

test('parseCssColor: hex, rgb, rgba e invalidos', () => {
    assert.deepEqual(parseCssColor('#fff'), { r: 255, g: 255, b: 255, a: 1 });
    assert.deepEqual(parseCssColor('#336699'), { r: 51, g: 102, b: 153, a: 1 });
    assert.deepEqual(parseCssColor('rgb(10, 20, 30)'), { r: 10, g: 20, b: 30, a: 1 });
    assert.deepEqual(parseCssColor('rgba(10, 20, 30, 0.5)'), { r: 10, g: 20, b: 30, a: 0.5 });
    assert.deepEqual(parseCssColor('rgb(10 20 30 / 50%)'), { r: 10, g: 20, b: 30, a: 0.5 });
    assert.equal(parseCssColor('transparent').a, 0);
    assert.equal(parseCssColor('banana'), null);
    assert.equal(parseCssColor(''), null);
});

test('contraste: preto/branco = 21; mesma cor = 1', () => {
    const black = { r: 0, g: 0, b: 0, a: 1 };
    const white = { r: 255, g: 255, b: 255, a: 1 };
    assert.equal(Math.round(contrastRatio(black, white)), 21);
    assert.equal(contrastRatio(white, white), 1);
});

test('checkContrast: #777 sobre branco falha AA (4.48), #767676 passa (4.54)', () => {
    assert.equal(checkContrast({ fg: '#777777', bg: '#ffffff', fontPx: 14 }).pass, false);
    assert.equal(checkContrast({ fg: '#767676', bg: '#ffffff', fontPx: 14 }).pass, true);
    assert.equal(checkContrast({ fg: '#777777', bg: '#ffffff', fontPx: 24 }).pass, true); // texto grande exige 3:1
    assert.equal(checkContrast({ fg: 'banana', bg: '#fff', fontPx: 14 }), null);
});

test('checkContrast compoe fundo translucido sobre branco', () => {
    const r = checkContrast({ fg: '#000', bg: 'rgba(0,0,0,0.05)', fontPx: 14 });
    assert.ok(r.pass);
    assert.deepEqual(composite({ r: 0, g: 0, b: 0, a: 0.5 }, { r: 255, g: 255, b: 255, a: 1 }), { r: 127.5, g: 127.5, b: 127.5, a: 1 });
});

test('requiredContrast', () => {
    assert.equal(requiredContrast(14, false), 4.5);
    assert.equal(requiredContrast(19, true), 3);
    assert.equal(requiredContrast(19, false), 4.5);
    assert.equal(requiredContrast(24, false), 3);
});

test('rateMetric segue os limites dos Core Web Vitals', () => {
    assert.equal(rateMetric('LCP', 2400), 'good');
    assert.equal(rateMetric('LCP', 3000), 'needs-improvement');
    assert.equal(rateMetric('LCP', 5000), 'poor');
    assert.equal(rateMetric('CLS', 0.05), 'good');
    assert.equal(rateMetric('CLS', 0.3), 'poor');
    assert.equal(rateMetric('XXX', 1), null);
    assert.equal(rateMetric('LCP', NaN), null);
});

test('breakpointName, formatBytes e rgbToHex', () => {
    assert.equal(breakpointName(375), 'xs (< 576)');
    assert.equal(breakpointName(768), 'md (768-991)');
    assert.equal(breakpointName(1920), 'xxl (>= 1400)');
    assert.equal(formatBytes(512), '512 B');
    assert.equal(formatBytes(2048), '2.0 KB');
    assert.equal(formatBytes(3 * 1024 * 1024), '3.0 MB');
    assert.equal(formatBytes(-1), '--');
    assert.equal(rgbToHex({ r: 255, g: 0, b: 128 }), '#ff0080');
});
