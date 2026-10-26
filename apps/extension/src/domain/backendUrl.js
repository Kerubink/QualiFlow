import { DEFAULT_BACKEND_URL } from './constants.js';

// Valida a URL do backend digitada pelo usuario (usada pelas telas de configuracao).
// Vazio => URL padrao. Retorna { ok: true, url } ou { ok: false, error }.
export function parseBackendUrl(rawValue) {
    const value = String(rawValue || '').trim();
    if (!value) {
        return { ok: true, url: DEFAULT_BACKEND_URL };
    }

    let parsed;
    try {
        parsed = new URL(value);
    } catch {
        return { ok: false, error: 'URL da API Copilot invalida. Inclua http:// ou https://.' };
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
        return { ok: false, error: 'A URL da API Copilot deve usar HTTP ou HTTPS.' };
    }

    return {
        ok: true,
        url: `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, '')
    };
}

// Versao tolerante (usada em runtime): URL invalida cai silenciosamente na padrao.
export function normalizeBackendUrl(rawValue) {
    const value = String(rawValue || '').trim();
    if (!value) return DEFAULT_BACKEND_URL;

    try {
        const parsed = new URL(value);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            return DEFAULT_BACKEND_URL;
        }
        return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, '');
    } catch {
        return DEFAULT_BACKEND_URL;
    }
}
