import test from 'node:test';
import assert from 'node:assert/strict';
import { failedIds, filterSelected, selectAllIds, toggleId } from '../../src/domain/runSelection.js';

const tcs = [{ id: 1 }, { id: 2 }, { id: 3 }];

test('selectAllIds, toggleId (imutavel) e filterSelected preserva ordem', () => {
    const all = selectAllIds(tcs);
    assert.equal(all.size, 3);
    const less = toggleId(all, 2);
    assert.equal(all.has(2), true);
    assert.equal(less.has(2), false);
    assert.deepEqual(filterSelected(tcs, less).map((t) => t.id), [1, 3]);
    assert.equal(toggleId(less, 2).has(2), true);
});

test('failedIds so inclui reprovados', () => {
    const ids = failedIds(tcs, { 1: 'Passed', 2: 'Failed', 3: 'Blocked' });
    assert.deepEqual([...ids], [2]);
    assert.equal(failedIds(tcs).size, 0);
});
