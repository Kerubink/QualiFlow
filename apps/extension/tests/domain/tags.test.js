import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTags, normalizeTagList, suggestTags } from '../../src/domain/tags.js';
import { prepareScenarioForSave } from '../../src/domain/scenario.js';

test('parseTags le string do Azure e lista, sem vazios nem duplicatas', () => {
    assert.deepEqual(parseTags('Front; back ;Front;;'), ['Front', 'back']);
    assert.deepEqual(parseTags(['a', ' A ', 'b']), ['a', 'b']);
    assert.deepEqual(parseTags(undefined), []);
});

test('normalizeTagList preserva a ordem', () => {
    assert.deepEqual(normalizeTagList(['b', 'a', 'B']), ['b', 'a']);
});

test('suggestTags oculta as ja escolhidas e filtra pelo texto', () => {
    const available = ['Front', 'Back', 'Regressao', 'Smoke'];
    assert.deepEqual(suggestTags(available, ['front'], ''), ['Back', 'Regressao', 'Smoke']);
    assert.deepEqual(suggestTags(available, [], 'ba'), ['Back']);
    assert.deepEqual(suggestTags(available, [], '', 2), ['Front', 'Back']);
});

test('prepareScenarioForSave mantem tags escolhidas e herda do pai quando ausentes', () => {
    assert.deepEqual(prepareScenarioForSave({ title: 't', steps: [], tags: ['A', 'a', 'B'] }).tags, ['A', 'B']);
    assert.equal('tags' in prepareScenarioForSave({ title: 't', steps: [] }), false);
    assert.deepEqual(prepareScenarioForSave({ title: 't', steps: [], tags: [] }).tags, []);
});
