// E2E do runner no playground (Chrome headless real). Rode: npm run test:e2e
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { findChrome, sleep, startPlayground } from './harness.mjs';
import { isStrongPassword, isValidCnh, isValidCpf, isValidPis } from '../../src/domain/testData.js';

const skip = findChrome() ? false : 'Chrome nao encontrado (defina CHROME_BIN)';
let b;

before(async () => { if (!skip) b = await startPlayground(); });
after(async () => { if (b) await b.close(); });

test('autofill: detecta os tipos certos e preenche com valores validos/invalidos', { skip }, async () => {
    await b.fresh();
    await b.waitFor("document.querySelectorAll('.qualiflow-autofill-icon').length > 0", { what: 'icones' });
    assert.equal(await b.ev("document.querySelectorAll('.qualiflow-autofill-icon').length"), 23);

    // clique simples = valido
    const cpf = await b.ev(`(() => { const i = document.querySelector('#f-cpf'); const icon = [...document.querySelectorAll('.qualiflow-autofill-icon')].find((x) => x.title.includes('CPF')); icon.click(); return i.value; })()`);
    assert.ok(isValidCpf(cpf), `CPF invalido: ${cpf}`);

    // Shift+clique abre o menu; "inválido" gera CPF invalido
    await b.ev(`(() => { const icon = [...document.querySelectorAll('.qualiflow-autofill-icon')].find((x) => x.title.includes('CPF')); icon.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true })); })()`);
    assert.ok(await b.exists('.qualiflow-autofill-menu'));
    await b.ev(`[...document.querySelectorAll('.qualiflow-autofill-menu button')].find((x) => x.textContent.includes('inválido')).click()`);
    const bad = await b.ev("document.querySelector('#f-cpf').value");
    assert.equal(isValidCpf(bad), false);

    // tipos novos (o icone de um campo fora da tela fica oculto de proposito: rola cada campo antes)
    const values = await b.ev(`(async () => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const fill = async (name) => {
            const el = document.querySelector('[name="' + name + '"]');
            el.scrollIntoView({ block: 'center' });
            await wait(250);
            const r = el.getBoundingClientRect();
            const icon = [...document.querySelectorAll('.qualiflow-autofill-icon')].find((i) => {
                const ir = i.getBoundingClientRect();
                return i.style.display !== 'none' && Math.abs(ir.top + ir.height / 2 - (r.top + r.height / 2)) < 3 && Math.abs(ir.right - r.right) < 12;
            });
            if (!icon) throw new Error('sem icone para ' + name);
            icon.click();
            return el.value;
        };
        return { cnh: await fill('cnh'), pis: await fill('pis'), nova: await fill('novaSenha'), nome: await fill('nomeCompleto') };
    })()`);
    assert.ok(isValidCnh(values.cnh));
    assert.ok(isValidPis(values.pis));
    assert.ok(isStrongPassword(values.nova));
    assert.ok(values.nome.split(' ').length >= 3);
    assert.deepEqual(b.errors, []);
});

test('execucao: selecao de CTs, passos, timers e duracao enviada', { skip }, async () => {
    await b.fresh();
    await b.click('#open-runner');
    await b.waitFor("!!document.getElementById('qualiflow-start-run-btn')");
    // desmarca o ultimo CT
    await b.ev(`document.querySelectorAll('[data-tc]')[3].click()`);
    assert.match(await b.text('#qualiflow-start-run-btn'), /\(3\)/);
    await b.click('#qualiflow-start-run-btn');
    await b.waitFor("!!document.querySelector('.qualiflow-run-ct-card')", { timeout: 10000 });
    assert.match(await b.text('.qualiflow-run-summary-pos'), /de 3/);
    assert.ok(await b.exists('#qualiflow-runner-header #qualiflow-ct-timer'), 'timer no cabecalho');

    await b.click('.step-btn.pass-btn[data-idx="0"]');
    await b.click('.step-btn.pass-btn[data-idx="1"]');
    await b.click('#qualiflow-save-tc');
    await b.waitFor("document.querySelector('.qualiflow-run-id')?.textContent.includes('18002')", { what: 'avancou de CT' });
    const sent = await b.ev(`(() => { const d = [...document.querySelectorAll('#log details')].find((x) => x.textContent.includes('UPDATE_TEST_RESULT')); return d.querySelector('pre').textContent; })()`);
    assert.match(sent, /"durationMs": \d+/);
    assert.deepEqual(b.errors, []);
});

test('pausa real, bolinha minimizada e camada de bloqueio', { skip }, async () => {
    await b.fresh();
    await b.startRun();
    await b.click('#qualiflow-runner-minimize');
    await b.waitFor("document.getElementById('qualiflow-runner-bubble').dataset.mode === 'running'");
    await sleep(1300);
    assert.match(await b.text('#qualiflow-runner-bubble'), /^\d\d:\d\d$/);

    await b.ev("document.getElementById('qualiflow-runner-bubble').click()");
    await b.click('#qualiflow-ct-timer-toggle');
    assert.ok(await b.exists('#qualiflow-pause-guard'));
    await b.click('.step-btn.pass-btn[data-idx="0"]'); // clique programatico nao pode alterar nada
    assert.equal(await b.text('.qualiflow-run-step-badge'), 'Pendente');
    const t1 = await b.text('#qualiflow-ct-timer');
    await sleep(1500);
    assert.equal(await b.text('#qualiflow-ct-timer'), t1);

    await b.click('#qualiflow-runner-minimize');
    assert.ok(await b.exists('#qualiflow-runner-bubble svg rect'), 'icone de pausa na bolinha');
    await b.click('#qualiflow-pause-guard-resume');
    await b.waitFor("document.getElementById('qualiflow-runner-bubble').dataset.mode === 'running'");
    assert.deepEqual(b.errors, []);
});

test('menu, HUB, depurador CSS e ancoragem', { skip }, async () => {
    await b.fresh();
    await b.startRun();
    await b.click('#qualiflow-runner-settings');
    const items = await b.ev("[...document.querySelectorAll('#qualiflow-runner-menu [data-menu]')].map((x) => x.dataset.menu)");
    for (const k of ['autofill', 'cssdebug', 'uitools', 'probe', 'alerts', 'dock', 'shortcuts', 'reset-timer', 'end-session']) assert.ok(items.includes(k), `falta ${k}`);

    await b.click('[data-menu="cssdebug"]');
    assert.ok(await b.exists('#qualiflow-css-debug-style'));
    assert.equal(await b.ev("getComputedStyle(document.getElementById('qualiflow-runner-window')).outlineStyle"), 'none');
    await b.click('[data-menu="cssdebug"]');
    assert.equal(await b.exists('#qualiflow-css-debug-style'), false);

    await b.click('[data-menu="dock"]');
    assert.ok(await b.ev("document.getElementById('qualiflow-runner-window').classList.contains('is-docked')"));
    assert.equal(await b.ev("document.documentElement.style.marginRight"), '420px');
    await b.ev('document.getElementById("qualiflow-runner-body").click()');
    await b.click('#qualiflow-runner-minimize');
    assert.equal(await b.ev("document.documentElement.style.marginRight"), '');
    await b.ev("document.getElementById('qualiflow-runner-bubble').click()");
    await b.click('#qualiflow-runner-settings');
    await b.click('[data-menu="dock"]');
    assert.equal(await b.ev("document.documentElement.style.marginRight"), '');

    await b.click('#qualiflow-runner-hub');
    const sections = await b.ev("[...document.querySelectorAll('#qualiflow-hub h3')].map((h) => h.textContent)");
    for (const s of ['Execução', 'Resultados', 'Ambiente', 'Relatório da execução', 'Notas da sessão']) assert.ok(sections.includes(s), `HUB sem "${s}"`);
    assert.deepEqual(b.errors, []);
});

test('criterios de aceite do card pai em painel flutuante (HTML sanitizado)', { skip }, async () => {
    await b.fresh();
    await b.startRun();
    await b.click('#qualiflow-runner-criteria');
    await b.ev('new Promise((r) => setTimeout(r, 600))');
    const html = await b.ev("document.getElementById('qualiflow-criteria-body').innerHTML");
    assert.match(html, /Cenário 1/);
    assert.match(html, /<li>/);
    assert.doesNotMatch(html, /<script|alert\(1\)<\/script/i);
    assert.equal(await b.ev("document.getElementById('qualiflow-runner-criteria').getAttribute('aria-pressed')"), 'true');
    await b.click('#qualiflow-criteria-close');
    assert.equal(await b.exists('#qualiflow-criteria'), false);
    assert.deepEqual(b.errors, []);
});

test('ancorar: elementos fixos do site saem da frente do runner e voltam ao desancorar', { skip }, async () => {
    await b.fresh();
    await b.startRun();
    const right = "document.getElementById('fixed-demo').getBoundingClientRect().right";
    const before = await b.ev(right);
    const vw = await b.ev('document.documentElement.clientWidth');
    assert.ok(before >= vw - 1, 'comeca encostado na borda');
    await b.click('#qualiflow-runner-settings');
    await b.click('[data-menu="dock"]');
    await b.ev('new Promise((r) => setTimeout(r, 200))');
    assert.ok(await b.ev(right) <= vw - 420 + 1, 'saiu da faixa do runner');
    await b.click('#qualiflow-runner-settings');
    await b.click('[data-menu="dock"]');
    assert.ok(Math.abs(await b.ev(right) - before) < 1, 'voltou ao lugar original');
    assert.equal(await b.ev("document.getElementById('fixed-demo').style.right"), '0px');
    assert.deepEqual(b.errors, []);
});

test('fontes e cores, responsividade e historico de desempenho', { skip }, async () => {
    await b.fresh();
    await b.startRun();
    await b.click('#qualiflow-runner-uitools');
    await b.click('[data-ui-tool="styles"]');
    const out = await b.text('#qualiflow-hub-tool-out');
    assert.match(out, /Fontes/);
    assert.match(out, /#[0-9a-f]{6}/);
    await b.click('[data-ui-tool="responsive"]');
    assert.match(await b.text('#qualiflow-hub-tool-out'), /Área útil atual/);
    await b.click('[data-ui-vp="mobile"]');
    await b.waitFor("document.getElementById('log').textContent.includes('EMULATE_VIEWPORT')", { what: 'mensagem EMULATE_VIEWPORT no log' });
    await b.click('[data-ui-tool="perf"]');
    await b.click('[data-ui-perfauto]');
    assert.equal(await b.ev("document.querySelector('[data-ui-perfauto]').checked"), true);
    assert.deepEqual(b.errors, []);
});

test('atalhos de teclado: aprovar, reprovar, pausar e retomar', { skip }, async () => {
    await b.fresh();
    await b.startRun();
    await b.key('Digit1', { alt: true });
    await b.waitFor("document.querySelector('.qualiflow-run-step-badge').textContent === 'Aprovado'", { what: 'Alt+1 aprova' });
    await b.key('Digit2', { alt: true });
    await b.waitFor("document.querySelectorAll('.qualiflow-run-step-badge')[1].textContent === 'Reprovado'", { what: 'Alt+2 reprova' });
    assert.ok(await b.ev("document.activeElement?.classList.contains('step-comment')"), 'foco no comentario da falha');
    await b.key('KeyP', { alt: true });
    await b.waitFor("!!document.getElementById('qualiflow-pause-guard')", { what: 'Alt+P pausa' });
    await b.key('KeyP', { alt: true });
    await b.waitFor("!document.getElementById('qualiflow-pause-guard')", { what: 'Alt+P retoma' });
    assert.deepEqual(b.errors, []);
});

test('bug completo: severidade, console/rede e vinculo no pedido', { skip }, async () => {
    await b.fresh();
    await b.startRun();
    await b.waitFor('!!window.__qualiflowProbe', { what: 'sonda instalada' });
    await b.click('#gen-console');
    await b.click('#gen-404');
    await b.click('#gen-net');
    await sleep(600);
    await b.key('Digit2', { alt: true });
    await b.waitFor("!!document.querySelector('.step-bug-btn')");
    await b.click('.step-bug-btn');
    await b.waitFor("!!document.getElementById('qualiflow-bug-dialog')");
    const probeLabel = await b.ev("document.getElementById('qf-bug-probe').parentElement.textContent");
    assert.match(probeLabel, /\((\d+)\)/);
    assert.ok(Number(probeLabel.match(/\((\d+)\)/)[1]) >= 3);
    await b.ev("(() => { const s = document.getElementById('qf-bug-sev'); s.value = 'high'; s.dispatchEvent(new Event('change', { bubbles: true })); })()");
    await b.ev("document.getElementById('qf-bug-got').value = 'Tela travou'");
    await b.click('#qf-bug-submit');
    await b.waitFor("!document.getElementById('qualiflow-bug-dialog')", { what: 'dialogo fechou' });
    const req = await b.ev(`[...document.querySelectorAll('#log details')].find((x) => x.textContent.includes('CREATE_BUG')).querySelector('pre').textContent`);
    assert.match(req, /"severity": "high"/);
    assert.match(req, /Erros de console e rede/);
    assert.match(req, /Tela travou/);
    assert.match(req, /token=\*\*\*/, 'token da URL deve ser mascarado');
    assert.ok(!req.includes('segredo123'), 'segredo vazou no bug');
    assert.match(await b.text('.qualiflow-toast'), /Bug #7001/);
    assert.deepEqual(b.errors.filter((e) => !/simulada/i.test(e)), []);
});

test('evidencia: recorte, marca d\'agua, upload e retry automatico', { skip }, async () => {
    await b.fresh();
    await b.startRun();
    await b.click('.step-evidence-btn[data-idx="0"]');
    await b.click('#qe-screenshot');
    await b.waitFor("!!document.getElementById('qualiflow-annotation-panel') && document.getElementById('qa-canvas').width > 0");
    assert.equal(await b.ev("document.getElementById('qa-canvas').width"), 1280);

    await b.click('[data-tool="crop"]');
    await b.ev(`(() => { const c = document.getElementById('qa-canvas'); const r = c.getBoundingClientRect(); const sx = r.width / c.width; const ev = (t, x, y) => c.dispatchEvent(new PointerEvent(t, { bubbles: true, pointerId: 1, button: 0, clientX: r.left + x * sx, clientY: r.top + y * sx })); ev('pointerdown', 100, 100); ev('pointermove', 700, 400); ev('pointerup', 700, 400); })()`);
    assert.ok(await b.ev("!document.getElementById('qa-crop-apply').hidden"));
    await b.click('#qa-crop-apply');
    assert.equal(await b.ev("document.getElementById('qa-canvas').width"), 600);
    assert.equal(await b.ev("document.getElementById('qa-canvas').height"), 300);
    await b.ev("document.getElementById('qa-watermark').click()");
    await b.click('#qa-save');
    await b.waitFor("document.querySelector('.qualiflow-run-ev-state')?.textContent.includes('Anexado')", { what: 'upload concluido' });

    // upload com erro: 3 tentativas automaticas (2 s + 5 s) e depois "Reenviar"
    await b.ev(`(() => { const s = document.getElementById('o-att'); s.value = 'error'; s.dispatchEvent(new Event('change')); })()`);
    await b.click('#qe-screenshot');
    await b.waitFor("!!document.getElementById('qualiflow-annotation-panel') && document.getElementById('qa-canvas').width > 0");
    await b.click('#qa-save');
    await b.waitFor("document.querySelector('.qualiflow-run-ev-state.is-pending')?.textContent.includes('tentativa 2')", { timeout: 6000, what: 'tentativa 2' });
    await b.waitFor("!!document.querySelector('.qe-retry-btn')", { timeout: 12000, what: 'erro final com Reenviar' });
    const attempts = await b.ev("[...document.querySelectorAll('#log details')].filter((x) => x.textContent.includes('ADD_ATTACHMENT')).length");
    assert.equal(attempts, 4, '1 envio bem-sucedido + 3 tentativas do envio com erro');
    assert.deepEqual(b.errors, []);
});

test('persistencia: recarregar a pagina oferece retomar a execucao', { skip }, async () => {
    await b.fresh();
    await b.startRun();
    await b.click('.step-btn.pass-btn[data-idx="0"]');
    await sleep(3500); // autosave a cada ~3 s
    await b.reload();
    await b.click('#open-runner');
    await b.waitFor("!!document.getElementById('qualiflow-restore-btn')", { what: 'oferta de retomar' });
    assert.match(await b.text('.qualiflow-run-restore-text'), /0 de 4 CT/);
    await b.click('#qualiflow-restore-btn');
    await b.waitFor("!!document.querySelector('.qualiflow-run-step-badge')");
    assert.equal(await b.text('.qualiflow-run-step-badge'), 'Aprovado', 'resultado do passo restaurado');
    assert.equal(await b.exists('#qualiflow-pause-guard'), false, 'ja retomado, sem camada de bloqueio');
    assert.ok(await b.exists('#qualiflow-ct-timer'));
    assert.deepEqual(b.errors, []);
});

test('ferramentas de UI: acessibilidade, desempenho e regua', { skip }, async () => {
    await b.fresh();
    await b.startRun();
    await b.click('#qualiflow-runner-uitools');
    await b.click('[data-ui-tool="a11y"]');
    const a11y = await b.text('#qualiflow-hub-tool-out');
    assert.match(a11y, /problema\(s\)/);
    assert.match(a11y, /Campos sem rótulo/);
    await b.click('[data-ui-tool="perf"]');
    assert.match(await b.text('#qualiflow-hub-tool-out'), /TTFB/);
    await b.click('[data-ui-fold="perf"]');
    assert.equal(await b.ev("document.querySelector('[data-ui-fold=\"perf\"] + .qualiflow-uifold-body').hidden"), true);
    assert.match(await b.text('[data-ui-fold="perf"]'), /LCP/);
    await b.click('[data-ui-fold="perf"]');
    assert.equal(await b.ev("document.querySelector('[data-ui-fold=\"perf\"] + .qualiflow-uifold-body').hidden"), false);
    await b.click('[data-ui-tool="ruler"]');
    assert.ok(await b.exists('#qualiflow-ruler'));
    await b.key('Escape');
    await b.waitFor("!document.getElementById('qualiflow-ruler')", { what: 'regua encerrada com Esc' });
    assert.deepEqual(b.errors, []);
});

test('fim da execucao: relatorio e re-execucao dos reprovados', { skip }, async () => {
    await b.fresh({ latencyMs: 50, attachmentMode: 'success', saveFails: false, bugFails: false, tcCount: 2 });
    await b.startRun();
    // CT 1 reprovado, CT 2 aprovado
    await b.click('.step-btn.fail-btn[data-idx="0"]');
    await b.click('#qualiflow-save-tc');
    await b.waitFor("document.querySelector('.qualiflow-run-id')?.textContent.includes('18002')");
    await b.click('.step-btn.pass-btn[data-idx="0"]');
    await b.click('#qualiflow-save-tc');
    await b.waitFor("!!document.getElementById('qualiflow-report-copy-btn')", { what: 'tela final' });
    assert.match(await b.text('#qualiflow-rerun-failed-btn'), /\(1\)/);
    await b.click('#qualiflow-report-copy-btn');
    await b.waitFor("document.querySelector('.qualiflow-toast')?.textContent.includes('Relatório')");

    await b.click('#qualiflow-rerun-failed-btn');
    await b.waitFor("document.querySelector('.qualiflow-run-summary-pos')?.textContent.includes('de 1')", { timeout: 10000, what: 'nova run com 1 CT' });
    assert.match(await b.text('.qualiflow-run-id'), /18001/);
    assert.deepEqual(b.errors, []);
});

test('console integrado: eventos, filtros, busca, detalhe, limpar e contador', { skip }, async () => {
    await b.fresh();
    await b.startRun();
    await b.waitFor('!!window.__qualiflowProbe', { what: 'sonda instalada' });
    await b.click('#gen-console');
    await b.click('#gen-warn');
    await b.click('#gen-404');
    await b.click('#gen-net');
    await b.waitFor("document.getElementById('qualiflow-console-badge').textContent === '3'", { what: 'contador de nao vistos (avisos nao contam)' });

    await b.click('#qualiflow-runner-console');
    assert.ok(await b.exists('#qualiflow-console'));
    assert.equal(await b.ev("document.getElementById('qualiflow-console-badge').hidden"), true, 'contador zera ao abrir');
    const rows = () => b.ev("document.querySelectorAll('#qualiflow-console-list .qualiflow-console-row').length");
    assert.equal(await rows(), 4);
    const counts = await b.ev("[...document.querySelectorAll('#qualiflow-console [data-count]')].map((x) => x.textContent)");
    assert.deepEqual(counts, ['4', '1', '1', '2']);

    await b.click('[data-filter="network"]');
    assert.equal(await rows(), 2);
    await b.click('[data-filter="errors"]');
    assert.equal(await rows(), 1);
    await b.click('[data-filter="all"]');
    await b.ev("(() => { const i = document.getElementById('qualiflow-console-search'); i.value = 'obsoleto'; i.dispatchEvent(new Event('input', { bubbles: true })); })()");
    assert.equal(await rows(), 1);
    assert.match(await b.text('.qualiflow-console-tag'), /AVISO/);
    await b.ev("(() => { const i = document.getElementById('qualiflow-console-search'); i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); })()");

    // detalhe expansivel; token mascarado
    await b.ev("[...document.querySelectorAll('.qualiflow-console-row.is-network .qualiflow-console-main')][0].click()");
    const detail = await b.text('.qualiflow-console-detail');
    assert.match(detail, /Status: 404/);
    assert.match(detail, /token=\*\*\*/);
    assert.ok(!detail.includes('segredo123'));

    // limpar esconde a lista, mas eventos novos aparecem; Alt+J fecha
    await b.click('#qualiflow-console-clear');
    assert.match(await b.text('.qualiflow-console-empty'), /Nenhum erro capturado/);
    await b.click('#gen-console');
    await b.waitFor("document.querySelectorAll('#qualiflow-console-list .qualiflow-console-row').length === 1", { what: 'evento novo apos limpar' });
    await b.key('KeyJ', { alt: true });
    await b.waitFor("!document.getElementById('qualiflow-console')", { what: 'Alt+J fecha o console' });
    assert.deepEqual(b.errors, []);
});
