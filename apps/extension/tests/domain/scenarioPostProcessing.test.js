import test from 'node:test';
import assert from 'node:assert/strict';
import { postProcessGeneratedScenarios } from '../../src/domain/scenarioPostProcessing.js';
import { ensureScenarioParamsDefault } from '../../src/domain/scenario.js';

test('resposta vazia vira estrutura minima', () => {
    const r = postProcessGeneratedScenarios(null, {}, ensureScenarioParamsDefault);
    assert.deepEqual(r, {
        total_criterios: 0,
        total_tests: 0,
        coverage_analysis: { rtm_matrix: [], insights: '', coverage_score: '0%' },
        test_cases: []
    });
});

test('aplica parametros padrao em cada cenario e conta total_tests', () => {
    const raw = { test_cases: [{ title: 'Usar @cpf', steps: [] }], total_criterios: 2 };
    const r = postProcessGeneratedScenarios(raw, {}, ensureScenarioParamsDefault);
    assert.equal(r.total_tests, 1);
    assert.equal(r.total_criterios, 2);
    assert.deepEqual(r.test_cases[0].parameters, { '@cpf': '###' });
});
