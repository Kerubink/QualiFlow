import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_BACKEND_URL, normalizeCopilotModel, normalizeSelectedAi } from '../../src/domain/constants.js';
import { normalizeBackendUrl, parseBackendUrl } from '../../src/domain/backendUrl.js';
import { hasAiConfig, hasAzureConfig, hasJiraConfig, isRunnerDisabled } from '../../src/domain/settingsRules.js';

test('normalizeSelectedAi cai em gemini para provedores invalidos (ex.: grok legado)', () => {
    assert.equal(normalizeSelectedAi('groq'), 'groq');
    assert.equal(normalizeSelectedAi('copilot'), 'copilot');
    assert.equal(normalizeSelectedAi('grok'), 'gemini');
    assert.equal(normalizeSelectedAi(undefined), 'gemini');
});

test('normalizeCopilotModel', () => {
    assert.equal(normalizeCopilotModel(' gpt-5-mini '), 'gpt-5-mini');
    assert.equal(normalizeCopilotModel('modelo-x'), 'claude-sonnet-4.5');
});

test('parseBackendUrl valida protocolo e remove barras finais', () => {
    assert.deepEqual(parseBackendUrl(''), { ok: true, url: DEFAULT_BACKEND_URL });
    assert.deepEqual(parseBackendUrl('http://localhost:3000/'), { ok: true, url: 'http://localhost:3000' });
    assert.equal(parseBackendUrl('localhost:3000').ok, false);
    assert.equal(parseBackendUrl('ftp://x.com').ok, false);
});

test('normalizeBackendUrl cai silenciosamente na URL padrao', () => {
    assert.equal(normalizeBackendUrl('lixo'), DEFAULT_BACKEND_URL);
    assert.equal(normalizeBackendUrl('https://api.exemplo.com/v1/'), 'https://api.exemplo.com/v1');
});

test('regras de configuracao', () => {
    assert.equal(hasAzureConfig({ azureSessionToken: 't', azureOrg: 'o', azureProject: 'p' }), true);
    assert.equal(hasAzureConfig({ azureSessionToken: 't', azureOrg: 'o' }), false);
    assert.equal(hasAzureConfig({ azurePat: 'p', azureOrg: 'o', azureProject: 'p' }), true);
    assert.equal(hasAzureConfig({ azurePat: 'p', azureOrg: 'o' }), false);
    assert.equal(hasJiraConfig({ jiraDomain: 'd', jiraSessionToken: 't', jiraProjectKey: 'K' }), true);
    assert.equal(hasAiConfig({ groqKey: 'k' }, 'groq'), true);
    assert.equal(hasAiConfig({ copilotToken: 'x' }, 'copilot'), true);
    assert.equal(hasAiConfig({}, 'gemini'), false);
    assert.equal(isRunnerDisabled({ runnerEnabled: false }), true);
    assert.equal(isRunnerDisabled({}), false);
});
