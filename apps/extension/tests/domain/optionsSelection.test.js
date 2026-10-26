import test from 'node:test';
import assert from 'node:assert/strict';
import {
    normalizeAzureOrgUrl,
    filterAllowedCopilotModels,
    resolveBoardUserLabel
} from '../../src/domain/optionsSelection.js';

test('normalizeAzureOrgUrl remove espacos e barras finais', () => {
    assert.equal(normalizeAzureOrgUrl('  https://dev.azure.com/org// '), 'https://dev.azure.com/org');
    assert.equal(normalizeAzureOrgUrl(undefined), '');
});

test('filterAllowedCopilotModels filtra modelos nao permitidos', () => {
    assert.deepEqual(filterAllowedCopilotModels(['gpt-5-mini', 'x', 'claude-opus-4.5']), ['gpt-5-mini', 'claude-opus-4.5']);
    assert.deepEqual(filterAllowedCopilotModels(null), []);
});

test('resolveBoardUserLabel usa a primeira identificacao disponivel', () => {
    assert.equal(resolveBoardUserLabel({ name: 'A', email: 'a@x.com' }), 'A');
    assert.equal(resolveBoardUserLabel({ emailAddress: 'b@x.com' }), 'b@x.com');
    assert.equal(resolveBoardUserLabel(null), undefined);
});
