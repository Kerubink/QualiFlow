import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHtmlReport, buildMarkdownReport, escapeHtmlText, outcomeLabel, plainText } from '../../src/domain/runReport.js';

const data = () => ({
    workItemId: 100, workItemTitle: 'Cadastro <script>', startedAt: 1700000000000, finishedAt: 1700000600000, totalMs: 600000, pauses: '1 pausa, 00:30',
    environment: 'URL: http://x\nNavegador: Chrome 131',
    summary: { total: 2, passed: 1, failed: 1, blocked: 0, other: 0, pending: 0 }, passRate: 50,
    cases: [
        { id: 1, title: 'Login | válido', outcome: 'Passed', durationMs: 65000, steps: [{ order: 1, action: '<b>Abrir</b>&nbsp;tela', expected: 'ok', outcome: 'Passed', durationMs: 3000 }], evidences: [{ name: 'a.png', status: 'uploaded' }] },
        { id: 2, title: 'Falha', outcome: 'Failed', durationMs: 1000, comment: 'quebrou', steps: [{ order: 1, action: 'x', expected: '', outcome: 'Failed', comment: 'erro 500' }], evidences: [] }
    ],
    bugs: [{ id: 7001, tcId: 2 }], notes: 'nota 1'
});

test('plainText remove tags e decodifica entidades', () => {
    assert.equal(plainText('<b>Abrir</b>&nbsp;tela<br>fim &amp; ok'), 'Abrir tela\nfim & ok');
    assert.equal(plainText(null), '');
});

test('outcomeLabel e escapeHtmlText', () => {
    assert.equal(outcomeLabel('Passed'), 'Aprovado');
    assert.equal(outcomeLabel(undefined), 'Sem resultado');
    assert.equal(outcomeLabel('Outro'), 'Outro');
    assert.equal(escapeHtmlText('<a href="x">&'), '&lt;a href=&quot;x&quot;&gt;&amp;');
});

test('markdown tem resumo, ambiente, casos, bugs e notas; escapa pipe em celulas', () => {
    const md = buildMarkdownReport(data());
    assert.match(md, /# Relatório de execução - PBI #100/);
    assert.match(md, /\| 2 \| 1 \| 1 \| 0 \| 0 \| 50% \|/);
    assert.match(md, /```\nURL: http:\/\/x/);
    assert.match(md, /### CT #1 - Login \| válido/);
    assert.match(md, /\| 1 \| Abrir tela \| ok \| Aprovado \| 00:03 \|/);
    assert.match(md, /Reprovado - erro 500/);
    assert.match(md, /Bug #7001 \(CT #2\)/);
    assert.match(md, /## Notas\n\nnota 1/);
    assert.match(md, /a\.png \(enviada ao Azure\)/);
});

test('html escapa conteudo e e um documento completo', () => {
    const html = buildHtmlReport(data());
    assert.ok(html.startsWith('<!doctype html>'));
    assert.ok(!html.includes('<script>'));
    assert.match(html, /Cadastro &lt;script&gt;/);
    assert.match(buildMarkdownReport(data()), /\*\*Cadastro <script>\*\*/);
    assert.match(html, /Taxa de aprovação/);
    assert.match(html, /Bug #7001/);
});

test('relatorio tolera dados minimos', () => {
    const md = buildMarkdownReport({ workItemId: 1 });
    assert.match(md, /PBI #1/);
    assert.match(md, /\| 0 \| 0 \| 0 \| 0 \| 0 \| -- \|/);
    assert.ok(buildHtmlReport({ workItemId: 1 }).includes('</html>'));
});
