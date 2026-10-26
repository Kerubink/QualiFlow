import test from 'node:test';
import assert from 'node:assert/strict';
import {
    ensureScenarioParamsDefault,
    extractScenarioParams,
    parseStepsFromText,
    prepareScenarioForSave,
    scenarioHasUnfilledParams,
    scenarioTitleLabel,
    withEditedAcceptance
} from '../../src/domain/scenario.js';
import { buildCopiedBddDescription, convertTestCaseToScenario, filterCopySourceCards, shouldShowRtm } from '../../src/domain/copiedScenario.js';
import { buildSavedSession, removeSession, restoreSavedSession } from '../../src/domain/savedSession.js';
import { isRtmRowCovered, stripCriteriaPrefix } from '../../src/domain/rtm.js';
import { buildSaveErrorMessage } from '../../src/domain/saveResult.js';

test('extractScenarioParams encontra @campo unicos e tolera cenario sem passos', () => {
    const sc = { title: 'Login @user', bdd_description: 'DADO @user e @senha', steps: [{ action: 'digita @user', expected: '' }] };
    assert.deepEqual(extractScenarioParams(sc), ['@user', '@senha']);
    assert.deepEqual(extractScenarioParams({ title: 'x' }), []);
});

test('ensureScenarioParamsDefault preenche ### apenas em parametros vazios', () => {
    const sc = { title: '@a @b', steps: [], parameters: { '@a': 'ok', '@b': '  ' } };
    ensureScenarioParamsDefault(sc);
    assert.deepEqual(sc.parameters, { '@a': 'ok', '@b': '###' });
});

test('parseStepsFromText usa separador literal \\n, || e marcador [EV]', () => {
    const steps = parseStepsFromText('abre [EV] || ve tela\\n\\nclica || ok');
    assert.deepEqual(steps, [
        { action: 'abre', expected: 've tela', needs_evidence: true },
        { action: 'clica', expected: 'ok', needs_evidence: false }
    ]);
});

test('prepareScenarioForSave valida assignee, remove tags e nao muta o original', () => {
    const original = { title: 't', steps: [], assignedTo: ' a@b.com ', tags: 'x' };
    const saved = prepareScenarioForSave(original);
    assert.equal(saved.assignedTo, 'a@b.com');
    assert.equal('tags' in saved, false);
    assert.equal(original.tags, 'x');
    assert.equal('assignedTo' in prepareScenarioForSave({ title: 't', steps: [], assignedTo: 'invalido' }), false);
    assert.equal(prepareScenarioForSave({ title: 't', steps: [], assignedTo: 'DOM\\user' }).assignedTo, 'DOM\\user');
});

test('scenarioHasUnfilledParams e scenarioTitleLabel', () => {
    assert.equal(scenarioHasUnfilledParams({ bdd_description: 'x @a', steps: [], parameters: {} }), true);
    assert.equal(scenarioHasUnfilledParams({ bdd_description: 'x @a', steps: [], parameters: { '@a': '1' } }), false);
    assert.equal(scenarioHasUnfilledParams({ bdd_description: 'x', steps: [] }), false);
    assert.equal(scenarioTitleLabel({ title: 'A' }), 'A [Novo]');
    assert.equal(scenarioTitleLabel({ title: 'A', id_original: 9 }), 'A [ID 9]');
});

test('withEditedAcceptance prefere criterios editados', () => {
    const wi = { id: 1, acceptance_criteria: 'orig' };
    assert.equal(withEditedAcceptance(wi, 'novo').acceptance_criteria, 'novo');
    assert.equal(withEditedAcceptance(wi, '').acceptance_criteria, 'orig');
    assert.equal(wi.acceptance_criteria, 'orig');
});

test('copia de CTs: BDD, conversao e filtro de card alvo', () => {
    assert.match(buildCopiedBddDescription([]), /^DADO contexto do card/);
    const bdd = buildCopiedBddDescription([{ action: 'DADO abre' }, { action: 'E loga' }, { action: 'clica' }, { action: 've' }]);
    assert.equal(bdd, 'DADO abre\nE loga\nQUANDO clica\nENTAO ve');
    const sc = convertTestCaseToScenario({ id: 5, steps: [{ action: '', expected: 'valida tela' }] }, { id: 1, title: 'Card' });
    assert.equal(sc.title, 'CT #5');
    assert.equal(sc.steps[0].action, 'DADO executar ação');
    assert.equal(sc.steps[0].needs_evidence, true);
    assert.deepEqual(sc.copied_from, { workItemId: 1, workItemTitle: 'Card', testCaseId: 5 });
    assert.deepEqual(filterCopySourceCards([{ id: 1 }, { id: '2' }], 1), [{ id: '2' }]);
    assert.equal(shouldShowRtm(null), true);
    assert.equal(shouldShowRtm({ mode: 'manual' }), false);
    assert.equal(shouldShowRtm({ mode: 'adapted' }), true);
});

test('sessoes salvas: build, restore e remove', () => {
    const scenarios = [{ title: 'a' }];
    const coverage = { test_cases: [] };
    const session = buildSavedSession({ workItem: { id: 7 }, scenarios, coverageData: coverage, copyContext: null }, 123);
    assert.equal(session.timestamp, 123);
    assert.equal(session.coverageData.test_cases, scenarios);
    const restored = restoreSavedSession(session);
    assert.equal(restored.copyContext, null);
    assert.equal(restored.workItem.id, 7);
    const legacy = restoreSavedSession({ workItem: { id: 1 }, scenariosData: scenarios });
    assert.equal(legacy.coverageData, scenarios);
    assert.deepEqual(removeSession({ 7: session, 8: {} }, 7), { 8: {} });
});

test('RTM: cobertura e prefixo de criterio', () => {
    assert.equal(isRtmRowCovered({ status: 'Coberto' }), true);
    assert.equal(isRtmRowCovered({ status: 'gap', covered_by_scenarios: ['CT1'] }), true);
    assert.equal(isRtmRowCovered({ status: 'gap', covered_by_scenarios: [] }), false);
    assert.equal(stripCriteriaPrefix('AC1.2: algo'), 'algo');
});

test('buildSaveErrorMessage detalha falhas e sucesso parcial', () => {
    const msg = buildSaveErrorMessage({
        error: 'falhou', partialSuccess: true,
        results: [{ status: 'success' }, { status: 'error', title: 'T', error: 'boom' }]
    });
    assert.match(msg, /SUCESSO PARCIAL: 1 teste\(s\) criado\(s\), 1 falharam/);
    assert.match(msg, /- T: boom/);
    assert.equal(buildSaveErrorMessage({}), 'Erro desconhecido ao salvar testes.');
});
