import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCopiedBddDescription, stripStepKeywords } from '../../src/domain/copiedScenario.js';

test('stripStepKeywords remove palavras-chave encadeadas', () => {
    assert.equal(stripStepKeywords('E ENTAO o saldo aparece'), 'o saldo aparece');
    assert.equal(stripStepKeywords('ENTAO ENTÃO valida'), 'valida');
});

test('stripStepKeywords preserva palavras que comecam com E/DADO', () => {
    assert.equal(stripStepKeywords('Exibe mensagem'), 'Exibe mensagem');
    assert.equal(stripStepKeywords('Dados validos'), 'Dados validos');
    assert.equal(stripStepKeywords('E-mail valido'), 'E-mail valido');
});

test('buildCopiedBddDescription nao duplica ENTAO', () => {
    const steps = ['DADO a', 'E b', 'QUANDO c', 'E ENTAO d'].map((action) => ({ action }));
    assert.ok(!/ENTAO ENTAO|E ENTAO/.test(buildCopiedBddDescription(steps)));
});
