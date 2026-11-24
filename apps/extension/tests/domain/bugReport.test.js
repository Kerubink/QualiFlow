import test from 'node:test';
import assert from 'node:assert/strict';
import { SEVERITIES, buildBugReproHtml, buildBugTitle, normalizeSeverity } from '../../src/domain/bugReport.js';

const tc = { id: 18001, title: 'Cadastrar <cliente>', steps: [
    { order: 1, action: 'Abrir tela', expected: 'ok' },
    { order: 2, action: 'Clicar em &lt;Salvar&gt;', expected: 'Salvo' },
    { order: 3, action: 'Fechar', expected: '' }
] };

test('severidades e normalizeSeverity', () => {
    assert.equal(SEVERITIES.length, 4);
    assert.equal(normalizeSeverity('HIGH'), 'high');
    assert.equal(normalizeSeverity('xyz'), null);
    assert.equal(normalizeSeverity(undefined), null);
});

test('buildBugTitle encurta a acao', () => {
    assert.equal(buildBugTitle(tc, tc.steps[1]), '[BUG] CT 18001, passo 2: Clicar em <Salvar>');
    const long = buildBugTitle(tc, { order: 1, action: 'a'.repeat(200) });
    assert.ok(long.length < 130 && long.endsWith('...'));
});

test('buildBugReproHtml traz passos ate a falha, esperado/obtido e escapa HTML', () => {
    const html = buildBugReproHtml({
        tc, stepIndex: 1, comment: 'Erro <500>', steps: [{ outcome: 'Passed' }, { outcome: 'Failed' }],
        environment: 'URL: http://x', probeText: '[t] erro: boom', evidenceNames: ['a.png'], severityLabel: '2 - Alta'
    });
    assert.match(html, /Severidade:<\/b> 2 - Alta/);
    assert.match(html, /<li>Abrir tela <i>\(Aprovado\)<\/i><\/li>/);
    assert.match(html, /<li>Clicar em &lt;Salvar&gt; <i>\(Reprovado\)<\/i><\/li>/);
    assert.ok(!html.includes('Fechar'));                       // passos depois da falha ficam de fora
    assert.match(html, /Resultado esperado:<\/b> Salvo/);
    assert.match(html, /Resultado obtido:<\/b> Erro &lt;500&gt;/);
    assert.match(html, /#18001 - Cadastrar &lt;cliente&gt;/);
    assert.match(html, /<pre>URL: http:\/\/x<\/pre>/);
    assert.match(html, /<pre>\[t\] erro: boom<\/pre>/);
    assert.match(html, /<li>a\.png<\/li>/);
    assert.ok(!html.includes('<500>'));
});

test('buildBugReproHtml sem opcionais nao inclui secoes vazias', () => {
    const html = buildBugReproHtml({ tc, stepIndex: 2, comment: '', steps: [] });
    assert.match(html, /\(não informado\)/);
    assert.ok(!html.includes('Ambiente'));
    assert.ok(!html.includes('Evidências'));
});
