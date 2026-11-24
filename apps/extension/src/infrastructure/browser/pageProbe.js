// Sonda de console e rede injetada no contexto (MAIN world) da pagina testada, sob demanda.
// `installPageProbe` e AUTOCONTIDA (sem closures): o Chrome a serializa em executeScript({ func }).
// Ela so posta mensagens window.postMessage({ source: 'qualiflow-probe', event }) para o content script.
// Registra apenas erros de console, excecoes e requisicoes que falharam (status 0 ou >= 400).

export function installPageProbe() {
    if (window.__qualiflowProbe) return;
    window.__qualiflowProbe = true;
    const SRC = 'qualiflow-probe';
    const post = (event) => { try { window.postMessage({ source: SRC, event }, '*'); } catch (_) { /* pagina bloqueou */ } };
    const text = (args) => Array.prototype.map.call(args, (a) => {
        if (a instanceof Error) return a.stack || a.message;
        if (a && typeof a === 'object') { try { return JSON.stringify(a); } catch (_) { return String(a); } }
        return String(a);
    }).join(' ').slice(0, 500);

    ['error', 'warn'].forEach((level) => {
        const original = console[level];
        console[level] = function () {
            post({ t: Date.now(), type: 'console', level, message: text(arguments) });
            return original.apply(this, arguments);
        };
    });
    window.addEventListener('error', (e) => {
        post({ t: Date.now(), type: 'error', message: `${e.message || 'Erro'}${e.filename ? ` (${e.filename}:${e.lineno})` : ''}`.slice(0, 500) });
    });
    window.addEventListener('unhandledrejection', (e) => {
        const r = e.reason;
        post({ t: Date.now(), type: 'rejection', message: String((r && (r.stack || r.message)) || r).slice(0, 500) });
    });

    const report = (method, url, status, start) => {
        if (status === 0 || status >= 400) {
            post({ t: Date.now(), type: 'request', method, url: String(url).slice(0, 500), status, ms: performance.now() - start });
        }
    };
    const originalFetch = window.fetch;
    if (typeof originalFetch === 'function') {
        window.fetch = function (input, init) {
            const start = performance.now();
            const method = (init && init.method) || (input && input.method) || 'GET';
            const url = typeof input === 'string' ? input : (input && input.url) || String(input);
            return originalFetch.apply(this, arguments).then((res) => { report(method, url, res.status, start); return res; },
                (err) => { report(method, url, 0, start); throw err; });
        };
    }
    const open = XMLHttpRequest.prototype.open;
    const send = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (method, url) {
        this.__qf = { method, url };
        return open.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function () {
        const start = performance.now();
        this.addEventListener('loadend', () => { if (this.__qf) report(this.__qf.method, this.__qf.url, this.status, start); });
        return send.apply(this, arguments);
    };
}

export function injectPageProbe(tabId) {
    return chrome.scripting.executeScript({ target: { tabId }, world: 'MAIN', func: installPageProbe });
}
