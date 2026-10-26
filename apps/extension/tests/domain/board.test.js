import test from 'node:test';
import assert from 'node:assert/strict';
import {
    detectBoardProviderFromHost,
    isValidAzureAssignee,
    resolveRequestedBoard,
    resolveScenarioAssignee
} from '../../src/domain/board.js';

test('detectBoardProviderFromHost', () => {
    assert.equal(detectBoardProviderFromHost('acme.atlassian.net'), 'jira');
    assert.equal(detectBoardProviderFromHost('dev.azure.com'), 'azure');
    assert.equal(detectBoardProviderFromHost('acme.visualstudio.com'), 'azure');
    assert.equal(detectBoardProviderFromHost('example.com'), 'azure');
});

test('resolveRequestedBoard prioriza jira explicito, senao usa o board salvo', () => {
    assert.equal(resolveRequestedBoard('jira', 'azure'), 'jira');
    assert.equal(resolveRequestedBoard('azure', 'jira'), 'jira');
    assert.equal(resolveRequestedBoard(undefined, undefined), 'azure');
});

test('isValidAzureAssignee aceita e-mail e DOMINIO\\usuario', () => {
    assert.equal(isValidAzureAssignee('qa@empresa.com'), true);
    assert.equal(isValidAzureAssignee('EMPRESA\\qa'), true);
    assert.equal(isValidAzureAssignee('nome sem formato'), false);
    assert.equal(isValidAzureAssignee('   '), false);
    assert.equal(isValidAzureAssignee(undefined), false);
});

test('resolveScenarioAssignee usa valido, cai no padrao ou remove', () => {
    assert.equal(resolveScenarioAssignee(' a@b.co ', 'qa@x.com'), 'a@b.co');
    assert.equal(resolveScenarioAssignee('invalido', 'qa@x.com'), 'qa@x.com');
    assert.equal(resolveScenarioAssignee(undefined, undefined), undefined);
});
