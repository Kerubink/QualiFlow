// Harness E2E minimo: sobe o servidor do playground e um Chrome headless controlado pelo DevTools Protocol.
// Sem dependencias externas (usa fetch/WebSocket nativos do Node >= 22).
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function findChrome() {
    if (process.env.CHROME_BIN) return process.env.CHROME_BIN;
    for (const bin of ['google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser', 'chrome']) {
        const r = spawnSync('which', [bin], { encoding: 'utf8' });
        if (r.status === 0 && r.stdout.trim()) return r.stdout.trim();
    }
    return null;
}

async function waitHttp(url, timeoutMs = 10000) {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) {
        try { if ((await fetch(url)).ok) return; } catch { /* ainda subindo */ }
        await sleep(150);
    }
    throw new Error(`Servidor nao respondeu em ${url}`);
}

export async function startPlayground({ serverPort = 5191, debugPort = 9341 } = {}) {
    const server = spawn(process.execPath, [join(ROOT, 'dev', 'serve.mjs')], { env: { ...process.env, PORT: String(serverPort) }, stdio: 'ignore' });
    await waitHttp(`http://127.0.0.1:${serverPort}/dev/`);

    const profile = mkdtempSync(join(tmpdir(), 'qf-e2e-'));
    const chrome = spawn(findChrome(), [
        '--headless=new', '--no-sandbox', '--disable-gpu', `--remote-debugging-port=${debugPort}`,
        '--window-size=1500,1000', `--user-data-dir=${profile}`, 'about:blank'
    ], { stdio: 'ignore' });

    let page;
    for (let i = 0; i < 60 && !page; i++) {
        try {
            const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json();
            page = targets.find((t) => t.type === 'page');
        } catch { /* chrome subindo */ }
        if (!page) await sleep(250);
    }
    if (!page) throw new Error('Chrome nao iniciou.');

    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((r) => { ws.onopen = r; });
    let seq = 0;
    const pending = new Map();
    const errors = [];
    ws.onmessage = (m) => {
        const d = JSON.parse(m.data);
        if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
        if (d.method === 'Runtime.exceptionThrown') {
            errors.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
        }
    };
    const send = (method, params = {}) => new Promise((r) => { const id = ++seq; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
    await send('Runtime.enable');
    await send('Page.enable');

    const api = {
        errors,
        url: `http://127.0.0.1:${serverPort}/dev/`,
        send,
        async ev(expr) {
            const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
            if (r.result.exceptionDetails) throw new Error(`Falha em ev(${expr.slice(0, 80)}): ${r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text}`);
            return r.result.result.value;
        },
        async click(sel) {
            const out = await api.ev(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return 'MISSING'; e.click(); return 'ok'; })()`);
            if (out === 'MISSING') throw new Error(`Elemento nao encontrado: ${sel}`);
        },
        text: (sel) => api.ev(`document.querySelector(${JSON.stringify(sel)})?.textContent?.trim() ?? null`),
        exists: (sel) => api.ev(`!!document.querySelector(${JSON.stringify(sel)})`),
        async waitFor(expr, { timeout = 8000, interval = 100, what = expr } = {}) {
            const end = Date.now() + timeout;
            let last;
            while (Date.now() < end) {
                try { last = await api.ev(expr); if (last) return last; } catch { /* pagina recarregando */ }
                await sleep(interval);
            }
            throw new Error(`Tempo esgotado esperando: ${what} (ultimo valor: ${JSON.stringify(last)})`);
        },
        async key(code, { alt = false, shift = false, ctrl = false } = {}) {
            const mods = (alt ? 1 : 0) | (ctrl ? 2 : 0) | (shift ? 8 : 0);
            const base = { code, modifiers: mods, windowsVirtualKeyCode: 0 };
            await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: code, ...base });
            await send('Input.dispatchKeyEvent', { type: 'keyUp', key: code, ...base });
        },
        /** Pagina limpa: apaga o estado salvo, aceita confirm/alert e recarrega o playground. */
        async fresh(config) {
            await send('Page.navigate', { url: api.url });
            await api.waitFor("document.readyState === 'complete'", { what: 'carregar' });
            await api.ev(`localStorage.clear(); ${config ? `localStorage.setItem('qf-dev-config', ${JSON.stringify(JSON.stringify(config))});` : ''} true`);
            await send('Page.navigate', { url: api.url });
            await api.waitFor("document.readyState === 'complete' && !!document.getElementById('qualiflow-fab-container')", { what: 'runner injetado' });
            await api.ev('window.confirm = () => true; window.alert = () => {}; true');
            api.errors.length = 0; // isolamento: cada cenario julga so os proprios erros de pagina
        },
        async reload() {
            await send('Page.navigate', { url: api.url });
            await api.waitFor("document.readyState === 'complete' && !!document.getElementById('qualiflow-fab-container')", { what: 'runner injetado (reload)' });
            await api.ev('window.confirm = () => true; window.alert = () => {}; true');
        },
        async startRun() {
            await api.click('#open-runner');
            await api.waitFor("!!document.getElementById('qualiflow-start-run-btn') || !!document.getElementById('qualiflow-restore-btn')", { what: 'tela inicial do runner' });
            if (await api.exists('#qualiflow-start-run-btn')) {
                await api.click('#qualiflow-start-run-btn');
                await api.waitFor("!!document.querySelector('.qualiflow-run-ct-card')", { what: 'execucao iniciada', timeout: 10000 });
            }
        },
        async close() {
            try { ws.close(); } catch { /* ja fechado */ }
            chrome.kill();
            server.kill();
            await sleep(300);
            rmSync(profile, { recursive: true, force: true });
        }
    };
    return api;
}
