/* Dados do ambiente de teste (para relatar bugs) e copia para a area de transferencia. */
import { parseBrowser, parseOs } from '../../../domain/runInsights.js';
import { breakpointName } from '../../../domain/uiChecks.js';

export function environmentInfo() {
    return {
        url: location.href,
        browser: parseBrowser(navigator.userAgent),
        os: parseOs(navigator.userAgent),
        viewport: `${window.innerWidth} x ${window.innerHeight}`,
        breakpoint: breakpointName(window.innerWidth),
        screen: `${screen.width} x ${screen.height}`,
        pixelRatio: `${window.devicePixelRatio}x`,
        language: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        dateTime: new Date().toLocaleString('pt-BR')
    };
}

export function copyText(text) {
    return navigator.clipboard.writeText(text).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;opacity:0;';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch { /* sem permissao de copia */ }
        ta.remove();
    });
}
