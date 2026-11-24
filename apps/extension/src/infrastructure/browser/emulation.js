// Emulacao de dispositivo na aba (teste de responsividade) via Chrome DevTools Protocol (chrome.debugger).
// Funciona independente do gerenciador de janelas: a pagina passa a ver a largura/altura pedidas, com media
// queries reais. Enquanto ativa, o Chrome mostra a faixa "esta depurando este navegador"; limpar remove tudo.

const VERSION = '1.3';
const call = (fn) => new Promise((resolve) => fn((value) => resolve({ value, error: chrome.runtime.lastError?.message })));

async function attach(tabId) {
    const r = await call((cb) => chrome.debugger.attach({ tabId }, VERSION, cb));
    // "already attached" (inclusive apos o service worker dormir) e aceitavel: seguimos usando a sessao
    if (r.error && !/already attached/i.test(r.error)) return r.error;
    return null;
}

const send = (tabId, method, params) => call((cb) => chrome.debugger.sendCommand({ tabId }, method, params, cb));

/** Aplica ({ width, height, mobile }) ou remove ({ clear: true }) a emulacao da aba. Resolve { ok } ou { error }. */
export async function emulateViewport(tabId, { width, height, mobile, clear }) {
    if (!tabId) return { error: 'Aba da pagina nao identificada.' };
    const attachError = await attach(tabId);
    if (attachError) return { error: attachError };

    if (clear) {
        await send(tabId, 'Emulation.clearDeviceMetricsOverride', {});
        await send(tabId, 'Emulation.setTouchEmulationEnabled', { enabled: false });
        const d = await call((cb) => chrome.debugger.detach({ tabId }, cb));
        return d.error && !/not attached/i.test(d.error) ? { error: d.error } : { ok: true };
    }

    const steps = {};
    const run = async (method, params) => {
        const r = await send(tabId, method, params);
        steps[method.split('.')[1]] = r.error || 'ok';
        return r;
    };
    const m = await run('Emulation.setDeviceMetricsOverride', {
        width, height, deviceScaleFactor: 0, mobile: !!mobile, screenWidth: width, screenHeight: height
    });
    if (m.error) return { error: m.error };
    await run('Emulation.setTouchEmulationEnabled', { enabled: !!mobile });
    // confirma o efeito lendo a largura de volta pela propria sessao de depuracao
    const probe = await run('Runtime.evaluate', { expression: 'window.innerWidth', returnByValue: true });
    return { ok: true, innerWidth: probe.value?.result?.value ?? null, steps };
}
