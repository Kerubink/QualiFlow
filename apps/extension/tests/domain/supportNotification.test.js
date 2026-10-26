import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildSupportStatusMessage,
    buildSupportWebhookPayload,
    computeInitialSupportTransitions,
    computeSupportTransitions,
    normalizeSupportStatus,
    parseAndValidateWebhookUrl,
    parseIdentityEmail,
    parseIdentityName,
    rollbackSnapshotEntry
} from '../../src/domain/supportNotification.js';

test('normalizeSupportStatus remove acentos e maiusculiza', () => {
    assert.equal(normalizeSupportStatus('Em Andamento'), 'EM ANDAMENTO');
    assert.equal(normalizeSupportStatus('novo'), 'NOVO');
    assert.equal(normalizeSupportStatus(''), 'NOVO');
    assert.equal(normalizeSupportStatus('Bloqueado'), 'BLOQUEADO');
});

test('identidade do solicitante em string e objeto', () => {
    assert.equal(parseIdentityName('Maria Silva <maria@x.com>'), 'Maria Silva');
    assert.equal(parseIdentityEmail('Maria Silva <maria@x.com>'), 'maria@x.com');
    assert.equal(parseIdentityName({ displayName: 'Joao' }), 'Joao');
    assert.equal(parseIdentityName(null), 'cliente');
});

test('webhook exige HTTPS', () => {
    assert.throws(() => parseAndValidateWebhookUrl('http://x.com/h'), /HTTPS/);
    assert.throws(() => parseAndValidateWebhookUrl(''), /nao configurado/);
    assert.equal(parseAndValidateWebhookUrl('https://x.com/h').host, 'x.com');
});

test('mensagem por transicao de status', () => {
    const base = { firstName: 'Ana', supportId: 7, title: 'T' };
    assert.match(buildSupportStatusMessage({ ...base, oldStatus: '', newStatus: 'NOVO' }), /foi recebido/);
    assert.match(buildSupportStatusMessage({ ...base, oldStatus: 'NOVO', newStatus: 'EM ANDAMENTO' }), /ja iniciou/);
    assert.match(buildSupportStatusMessage({ ...base, oldStatus: 'EM ANDAMENTO', newStatus: 'DONE' }), /concluido/);
});

test('primeira execucao notifica somente NOVO', () => {
    const supports = [{ id: 1, state: 'New' }, { id: 2, state: 'Novo' }, { id: 3, state: 'Done' }];
    const t = computeInitialSupportTransitions(supports);
    assert.deepEqual(t.map((x) => x.id), ['2']);
});

test('transicoes: card novo, mudanca de status e forceNotifyNovo', () => {
    const supports = [
        { id: 1, state: 'Novo' },
        { id: 2, state: 'Em Andamento' },
        { id: 3, state: 'Novo' },
        { id: 4, state: 'Done' }
    ];
    const previous = { 2: { state: 'NOVO' }, 3: { state: 'NOVO' }, 4: { state: 'DONE' } };

    const normal = computeSupportTransitions(supports, previous);
    assert.deepEqual(normal.map((t) => [t.id, t.oldStatus, t.newStatus]), [
        ['1', '', 'NOVO'],
        ['2', 'NOVO', 'EM ANDAMENTO']
    ]);

    const forced = computeSupportTransitions(supports, previous, { forceNotifyNovo: true });
    assert.deepEqual(forced.map((t) => t.id), ['1', '2', '3']);
    assert.equal(forced[2].forced, true);
});

test('rollbackSnapshotEntry restaura status anterior ou remove card novo', () => {
    const snapshot = { 1: { state: 'EM ANDAMENTO', title: 'a' }, 2: { state: 'NOVO', title: 'b' } };
    rollbackSnapshotEntry(snapshot, { id: '1', oldStatus: 'NOVO', item: { title: 'a' } });
    rollbackSnapshotEntry(snapshot, { id: '2', oldStatus: '', item: { title: 'b' } });
    assert.deepEqual(snapshot, { 1: { state: 'NOVO', title: 'a' } });
});

test('payload do webhook carrega Adaptive Card e metadados', () => {
    const payload = buildSupportWebhookPayload(
        { id: 9, title: 'Erro', requester: 'Ana Lima <ana@x.com>', url: 'https://u' },
        { oldStatus: 'NOVO', newStatus: 'DONE', timestamp: '2026-01-01T00:00:00.000Z' }
    );
    assert.equal(payload.type, 'AdaptiveCard');
    assert.equal(payload.qaSupportMeta.requesterEmail, 'ana@x.com');
    assert.equal(payload.qaSupportMeta.statusAnterior, 'NOVO');
    assert.equal(payload.actions[0].url, 'https://u');
});
