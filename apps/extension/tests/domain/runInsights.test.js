import test from 'node:test';
import assert from 'node:assert/strict';
import {
    averageMs, buildEnvironmentText, describePauses, estimateRemainingMs, evidenceTotals, parseBrowser, parseOs, passRate
} from '../../src/domain/runInsights.js';

test('averageMs ignora invalidos e devolve null sem dados', () => {
    assert.equal(averageMs([1000, 3000]), 2000);
    assert.equal(averageMs([1000, -5, NaN, undefined]), 1000);
    assert.equal(averageMs([]), null);
});

test('estimateRemainingMs', () => {
    assert.equal(estimateRemainingMs(60000, 3), 180000);
    assert.equal(estimateRemainingMs(0, 5), 0);
    assert.equal(estimateRemainingMs(null, 5), null);
    assert.equal(estimateRemainingMs(1000, -1), null);
});

test('passRate arredonda e trata zero concluidos', () => {
    assert.equal(passRate({ passed: 2, failed: 1 }), 67);
    assert.equal(passRate({ passed: 0, failed: 0 }), null);
    assert.equal(passRate({ passed: 3, failed: 0, blocked: 1 }), 75);
});

test('evidenceTotals soma por situacao', () => {
    const t = evidenceTotals([[{ status: 'uploaded' }, { status: 'error' }], [{ status: 'uploading' }, { status: 'pending' }]]);
    assert.deepEqual(t, { total: 4, uploaded: 1, pending: 2, error: 1 });
    assert.deepEqual(evidenceTotals(), { total: 0, uploaded: 0, pending: 0, error: 0 });
});

test('parseBrowser e parseOs', () => {
    const ua = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
    assert.equal(parseBrowser(ua), 'Chrome 131');
    assert.equal(parseBrowser(ua + ' Edg/130.0.1'), 'Edge 130');
    assert.equal(parseBrowser('x'), 'Desconhecido');
    assert.equal(parseOs(ua), 'Linux');
    assert.equal(parseOs('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'), 'Windows 10/11');
    assert.equal(parseOs(''), 'Desconhecido');
});

test('buildEnvironmentText omite campos vazios', () => {
    const text = buildEnvironmentText({ url: 'http://x', browser: 'Chrome 131', language: '' });
    assert.equal(text, 'URL: http://x\nNavegador: Chrome 131');
});

test('describePauses', () => {
    assert.equal(describePauses(), 'Nenhuma');
    assert.equal(describePauses(1, 65000), '1 pausa, 01:05');
    assert.equal(describePauses(3, 3725000), '3 pausas, 1:02:05');
});
