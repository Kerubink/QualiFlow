import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureScenarioParamsDefault, extractScenarioParams, parseStepsFromText } from '../../src/domain/scenario.js';

test('extractScenarioParams encontra @campos unicos em titulo, BDD e passos', () => {
    const item = {
        title: 'Login com @usuario',
        bdd_description: 'Dado @usuario e @senha',
        steps: [{ action: 'Informar @senha', expected: 'Ver @mensagem' }]
    };
    assert.deepEqual(extractScenarioParams(item).sort(), ['@mensagem', '@senha', '@usuario']);
});

test('extractScenarioParams tolera cenario sem steps', () => {
    assert.deepEqual(extractScenarioParams({ title: 'Sem params' }), []);
});

test('ensureScenarioParamsDefault preenche vazios com ### e preserva valores', () => {
    const item = { title: '@a e @b', steps: [], parameters: { '@a': 'x', '@b': '  ' } };
    ensureScenarioParamsDefault(item);
    assert.deepEqual(item.parameters, { '@a': 'x', '@b': '###' });
});

test('ensureScenarioParamsDefault nao cria parameters sem @campos', () => {
    const item = { title: 'nada', steps: [] };
    ensureScenarioParamsDefault(item);
    assert.equal(item.parameters, undefined);
});

test('parseStepsFromText separa acao/esperado e detecta [EV] (separador literal \\n)', () => {
    const steps = parseStepsFromText('Abrir app [EV] || App aberto\\nClicar || ');
    assert.deepEqual(steps, [
        { action: 'Abrir app', expected: 'App aberto', needs_evidence: true },
        { action: 'Clicar', expected: '', needs_evidence: false }
    ]);
});
