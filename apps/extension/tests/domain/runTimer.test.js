import test from 'node:test';
import assert from 'node:assert/strict';
import {
    bubbleStatus,
    createTimer,
    currentStepIndex,
    formatDuration,
    isRunning,
    summarizeRun,
    timerElapsed,
    timerPause,
    timerReset,
    timerStart
} from '../../src/domain/runTimer.js';

test('timer acumula tempo so enquanto esta rodando', () => {
    let t = createTimer();
    assert.equal(timerElapsed(t, 5000), 0);
    t = timerStart(t, 1000);
    assert.equal(isRunning(t), true);
    assert.equal(timerElapsed(t, 4000), 3000);
    t = timerPause(t, 4000);
    assert.equal(isRunning(t), false);
    assert.equal(timerElapsed(t, 99999), 3000);
    t = timerStart(t, 10000);
    assert.equal(timerElapsed(t, 12000), 5000);
});

test('start em timer rodando e pause em timer parado sao idempotentes', () => {
    const t = timerStart(createTimer(), 100);
    assert.equal(timerStart(t, 900), t);
    const paused = timerPause(t, 200);
    assert.equal(timerPause(paused, 500), paused);
});

test('timer nao fica negativo se o relogio voltar', () => {
    const t = timerStart(createTimer(), 5000);
    assert.equal(timerElapsed(t, 1000), 0);
});

test('timerReset zera', () => {
    assert.deepEqual(timerReset(), { elapsedMs: 0, startedAt: null });
});

test('formatDuration', () => {
    assert.equal(formatDuration(0), '00:00');
    assert.equal(formatDuration(65000), '01:05');
    assert.equal(formatDuration(3725000), '1:02:05');
    assert.equal(formatDuration(-5), '00:00');
    assert.equal(formatDuration('x'), '00:00');
    assert.equal(formatDuration(999), '00:00');
});

test('summarizeRun conta por resultado e calcula progresso', () => {
    const tcs = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }];
    const s = summarizeRun(tcs, { 1: 'Passed', 2: 'Failed', 3: 'Blocked', 4: 'NotApplicable' }, 4);
    assert.deepEqual(
        { total: s.total, passed: s.passed, failed: s.failed, blocked: s.blocked, other: s.other, pending: s.pending, done: s.done, percent: s.percent },
        { total: 5, passed: 1, failed: 1, blocked: 1, other: 1, pending: 1, done: 4, percent: 80 }
    );
});

test('summarizeRun trata lista vazia e resultado None como pendente', () => {
    assert.equal(summarizeRun([]).percent, 0);
    assert.equal(summarizeRun([{ id: 1 }], { 1: 'None' }).pending, 1);
});

test('currentStepIndex acha o primeiro passo sem resultado', () => {
    assert.equal(currentStepIndex([{ outcome: 'Passed' }, { outcome: 'None' }, { outcome: 'None' }]), 1);
    assert.equal(currentStepIndex([{ outcome: 'Passed' }]), -1);
    assert.equal(currentStepIndex([]), -1);
});

test('bubbleStatus: sem run, rodando e pausado', () => {
    assert.equal(bubbleStatus({ active: false, paused: false }).mode, 'idle');
    assert.equal(bubbleStatus({ active: false, paused: true }).mode, 'idle');

    const running = bubbleStatus({ active: true, paused: false, ctMs: 65000, runMs: 3725000 });
    assert.equal(running.mode, 'running');
    assert.equal(running.label, '01:05');
    assert.match(running.title, /Total: 1:02:05/);

    const paused = bubbleStatus({ active: true, paused: true, ctMs: 65000, runMs: 3725000 });
    assert.equal(paused.mode, 'paused');
    assert.equal(paused.label, '');
    assert.match(paused.title, /pausado em 01:05/);
});
