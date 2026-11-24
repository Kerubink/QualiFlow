import test from 'node:test';
import assert from 'node:assert/strict';
import { averageStepMs, isLongPause, isSlowStep } from '../../src/domain/runAlerts.js';

test('averageStepMs', () => {
    assert.equal(averageStepMs([10000, 20000]), 15000);
    assert.equal(averageStepMs([]), null);
});

test('isSlowStep exige media, 2x a media e no minimo 60s', () => {
    assert.equal(isSlowStep({ sinceMarkMs: 100000, avgStepMs: null }), false);
    assert.equal(isSlowStep({ sinceMarkMs: 50000, avgStepMs: 10000 }), false);  // abaixo do minimo
    assert.equal(isSlowStep({ sinceMarkMs: 60000, avgStepMs: 10000 }), true);
    assert.equal(isSlowStep({ sinceMarkMs: 100000, avgStepMs: 60000 }), false); // < 2x
    assert.equal(isSlowStep({ sinceMarkMs: 120000, avgStepMs: 60000 }), true);
    assert.equal(isSlowStep({ sinceMarkMs: NaN, avgStepMs: 1000 }), false);
});

test('isLongPause', () => {
    assert.equal(isLongPause({ pausedForMs: 299999 }), false);
    assert.equal(isLongPause({ pausedForMs: 300000 }), true);
    assert.equal(isLongPause({ pausedForMs: 10, limitMs: 5 }), true);
    assert.equal(isLongPause({ pausedForMs: NaN }), false);
});
