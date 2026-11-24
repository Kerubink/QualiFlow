import test from 'node:test';
import assert from 'node:assert/strict';
import { eventLine, formatProbeEvents, isFailedRequest, isNoteworthy, redactUrl, selectRelevant, summarizeProbe } from '../../src/domain/probeEvents.js';

const req = (status, extra = {}) => ({ t: 1, type: 'request', method: 'GET', url: 'http://x/api', status, ms: 12.4, ...extra });

test('redactUrl mascara tokens e preserva o resto', () => {
    assert.equal(redactUrl('http://x/a?token=abc&page=2'), 'http://x/a?token=***&page=2');
    assert.equal(redactUrl('http://x/a?Access_Token=abc#frag'), 'http://x/a?Access_Token=***#frag');
    assert.equal(redactUrl('http://x/a?senha=1&b'), 'http://x/a?senha=***&b');
    assert.equal(redactUrl('http://x/a'), 'http://x/a');
});

test('classificacao de eventos relevantes', () => {
    assert.equal(isFailedRequest(req(500)), true);
    assert.equal(isFailedRequest(req(0)), true);
    assert.equal(isFailedRequest(req(200)), false);
    assert.equal(isNoteworthy({ type: 'console', level: 'log' }), false);
    assert.equal(isNoteworthy({ type: 'console', level: 'warn' }), true);
    assert.equal(isNoteworthy({ type: 'error' }), true);
    assert.equal(isNoteworthy({ type: 'rejection' }), true);
    assert.equal(isNoteworthy(req(404)), true);
    assert.equal(isNoteworthy(req(200)), false);
});

test('selectRelevant filtra por tempo e limita', () => {
    const evs = [{ t: 1, type: 'error', message: 'a' }, { t: 5, type: 'error', message: 'b' }, { t: 6, type: 'console', level: 'log' }, { t: 7, type: 'error', message: 'c' }];
    assert.deepEqual(selectRelevant(evs, { sinceMs: 5 }).map((e) => e.message), ['b', 'c']);
    assert.equal(selectRelevant(evs, { max: 1 }).length, 1);
});

test('summarizeProbe', () => {
    const s = summarizeProbe([{ type: 'error' }, { type: 'console', level: 'error' }, { type: 'console', level: 'warn' }, req(500), req(200), { type: 'rejection' }]);
    assert.deepEqual(s, { errors: 3, warnings: 1, failedRequests: 1 });
});

test('eventLine e formatProbeEvents (dedupe, truncamento, redacao)', () => {
    assert.equal(eventLine(req(500), () => '10:00:00'), '[10:00:00] GET http://x/api -> 500 (12 ms)');
    assert.match(eventLine(req(0), () => 't'), /falha de rede/);
    assert.match(eventLine({ t: 1, type: 'console', level: 'error', message: 'x'.repeat(500) }, () => 't'), /x{20}\.\.\.$/);
    assert.match(eventLine(req(401, { url: 'http://x/a?token=zzz' }), () => 't'), /token=\*\*\*/);
    const text = formatProbeEvents([req(500), req(500), { t: 2, type: 'error', message: 'boom' }], () => 't');
    assert.equal(text, '[t] GET http://x/api -> 500 (12 ms) (x2)\n[t] erro: boom');
    assert.equal(formatProbeEvents([]), '');
});

// ------------------------------------------------------------- painel Console
import {
    PROBE_FILTERS, countByCategory, eventCategory, eventDetail, eventSummary, eventTag, filterEvents, unseenCount
} from '../../src/domain/probeEvents.js';

const mixed = () => [
    { id: 1, t: 10, type: 'console', level: 'error', message: 'Falha ao carregar' },
    { id: 2, t: 20, type: 'console', level: 'warn', message: 'Campo obsoleto' },
    { id: 3, t: 30, type: 'error', message: 'TypeError: x is undefined' },
    { id: 4, t: 40, type: 'rejection', message: 'Promise rejeitada' },
    { id: 5, t: 50, type: 'request', method: 'GET', url: 'http://x/api?token=abc&p=1', status: 500, ms: 12.6 },
    { id: 6, t: 60, type: 'request', method: 'POST', url: 'http://x/save', status: 0 }
];

test('eventCategory e eventTag', () => {
    assert.equal(eventCategory(mixed()[0]), 'error');
    assert.equal(eventCategory(mixed()[1]), 'warning');
    assert.equal(eventCategory(mixed()[3]), 'error');
    assert.equal(eventCategory(mixed()[4]), 'network');
    assert.deepEqual(mixed().map(eventTag), ['ERRO', 'AVISO', 'EXCEÇÃO', 'PROMISE', 'REDE', 'REDE']);
});

test('countByCategory', () => {
    assert.deepEqual(countByCategory(mixed()), { all: 6, errors: 3, warnings: 1, network: 2 });
    assert.deepEqual(countByCategory(), { all: 0, errors: 0, warnings: 0, network: 0 });
});

test('eventSummary mascara a URL e eventDetail traz os campos da requisicao', () => {
    assert.equal(eventSummary(mixed()[4]), 'GET http://x/api?token=***&p=1 -> 500');
    assert.equal(eventSummary(mixed()[5]), 'POST http://x/save -> falha de rede');
    const d = eventDetail(mixed()[4]);
    assert.match(d, /Método: GET/);
    assert.match(d, /URL: http:\/\/x\/api\?token=\*\*\*&p=1/);
    assert.match(d, /Status: 500/);
    assert.match(d, /Duração: 13 ms/);
    assert.match(eventDetail(mixed()[5]), /falha de rede \(sem resposta\)/);
    assert.equal(eventDetail(mixed()[0]), 'Falha ao carregar');
    assert.ok(!eventDetail(mixed()[4]).includes('abc'));
});

test('filterEvents: categoria, busca e instante inicial', () => {
    const evs = mixed();
    assert.equal(filterEvents(evs).length, 6);
    assert.deepEqual(filterEvents(evs, { filter: PROBE_FILTERS.ERRORS }).map((e) => e.id), [1, 3, 4]);
    assert.deepEqual(filterEvents(evs, { filter: PROBE_FILTERS.WARNINGS }).map((e) => e.id), [2]);
    assert.deepEqual(filterEvents(evs, { filter: PROBE_FILTERS.NETWORK }).map((e) => e.id), [5, 6]);
    assert.deepEqual(filterEvents(evs, { query: 'TYPEERROR' }).map((e) => e.id), [3]);
    assert.deepEqual(filterEvents(evs, { query: '500' }).map((e) => e.id), [5]);
    assert.deepEqual(filterEvents(evs, { query: 'falha' }).map((e) => e.id), [1, 6]);
    assert.deepEqual(filterEvents(evs, { filter: PROBE_FILTERS.NETWORK, query: 'save' }).map((e) => e.id), [6]);
    assert.deepEqual(filterEvents(evs, { sinceMs: 40 }).map((e) => e.id), [4, 5, 6]);
    assert.deepEqual(filterEvents(evs, { query: '  ' }).length, 6);
    assert.deepEqual(filterEvents(), []);
});

test('busca nao encontra o valor mascarado da URL', () => {
    assert.equal(filterEvents(mixed(), { query: 'abc' }).length, 0);
});

test('unseenCount ignora avisos e eventos ja vistos', () => {
    assert.equal(unseenCount(mixed(), 0), 5);
    assert.equal(unseenCount(mixed(), 45), 2);
    assert.equal(unseenCount([], 0), 0);
});
