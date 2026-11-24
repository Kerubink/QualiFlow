import test from 'node:test';
import assert from 'node:assert/strict';
import { SNAPSHOT_MAX_AGE_MS, SNAPSHOT_MAX_IMAGE_CHARS, isRestorable, isRunInProgress, restoreRun, serializeRun } from '../../src/domain/runSnapshot.js';

const baseState = () => ({
    runId: 9,
    currentTcIndex: 1,
    testCases: [{ id: 1, title: 'a', steps: [] }, { id: 2, title: 'b', steps: [] }],
    results: [{ resultId: 5, testCaseId: 1 }],
    stepResults: { 1: [{ stepId: 1, outcome: 'Passed' }] },
    overallOutcomes: {}, comments: { 1: 'ok' }, commentVisible: {}, finalOutcomes: { 1: 'Passed' },
    ctDurations: { 1: 5000 }, ctMarks: {},
    runTimer: { elapsedMs: 1000, startedAt: 4000 },
    ctTimers: { 2: { elapsedMs: 500, startedAt: 4500 } },
    events: [{ at: 1, text: 'x' }], bugs: [], pauseCount: 1, pausedMs: 10, startedAt: 100,
    evidences: {
        '1': [
            { name: 'a.png', type: 'image/png', status: 'uploaded', dataUrl: 'data:image/png;base64,AAA', azureId: 'z' },
            { name: 'b.png', type: 'image/png', status: 'error', error: 'x', dataUrl: 'data:image/png;base64,BBB' },
            { name: 'c.png', type: 'image/png', status: 'uploading', dataUrl: 'data:image/png;base64,CCC' },
            { name: 'v.webm', type: 'video/webm', status: 'uploading', dataUrl: 'blob:http://x/1', blob: {} },
            { name: 'big.png', type: 'image/png', status: 'error', dataUrl: 'data:' + 'A'.repeat(SNAPSHOT_MAX_IMAGE_CHARS + 1) }
        ]
    }
});

test('serializeRun congela timers e descarta dados pesados', () => {
    const snap = serializeRun(baseState(), { now: 6000, workItemId: 77, notes: 'n' });
    assert.equal(snap.runTimer.elapsedMs, 3000); // 1000 + (6000-4000)
    assert.equal(snap.runTimer.startedAt, null);
    assert.equal(snap.ctTimers[2].elapsedMs, 2000);
    const ev = snap.evidences['1'];
    assert.equal(ev[0].dataUrl, undefined);          // enviada: sem imagem
    assert.equal(ev[1].dataUrl, 'data:image/png;base64,BBB'); // com erro: guarda para reenvio
    assert.equal(ev[3].dataUrl, undefined);          // video: nunca
    assert.equal(ev[3].blob, undefined);
    assert.equal(ev[4].dataUrl, undefined);          // grande demais
    assert.equal(snap.notes, 'n');
    assert.doesNotThrow(() => JSON.stringify(snap));
});

test('restoreRun volta pausado e converte envios em andamento em erro', () => {
    const snap = serializeRun(baseState(), { now: 6000, workItemId: 77 });
    const st = restoreRun(snap, 9000);
    assert.equal(st.paused, true);
    assert.equal(st.pauseStartedAt, 9000);
    assert.equal(st.runTimer.startedAt, null);
    assert.equal(st.evidences['1'][2].status, 'error');
    assert.match(st.evidences['1'][2].error, /Reenviar/);
    assert.equal(st.evidences['1'][3].status, 'error');
    assert.match(st.evidences['1'][3].error, /indisponível/);
    assert.equal(st.events.at(-1).text.includes('restaurada'), true);
    assert.equal(st.currentTcIndex, 1);
});

test('isRestorable: versao, run, id do PBI, idade e fim da run', () => {
    const snap = serializeRun(baseState(), { now: 1000, workItemId: 77 });
    assert.equal(isRestorable(snap, { workItemId: 77, now: 2000 }), true);
    assert.equal(isRestorable(snap, { workItemId: '77', now: 2000 }), true);
    assert.equal(isRestorable(snap, { workItemId: 78, now: 2000 }), false);
    assert.equal(isRestorable(snap, { workItemId: 77, now: 1000 + SNAPSHOT_MAX_AGE_MS + 1 }), false);
    assert.equal(isRestorable({ ...snap, version: 99 }, { now: 2000 }), false);
    assert.equal(isRestorable({ ...snap, currentTcIndex: 2 }, { now: 2000 }), false);
    assert.equal(isRestorable(null), false);
    assert.equal(isRestorable({ ...snap, testCases: [] }, { now: 2000 }), false);
});

test('isRunInProgress', () => {
    assert.equal(isRunInProgress(baseState()), true);
    assert.equal(isRunInProgress({ ...baseState(), currentTcIndex: 2 }), false);
    assert.equal(isRunInProgress(null), false);
});
