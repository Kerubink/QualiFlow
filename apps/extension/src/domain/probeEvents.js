/*
 * Eventos capturados da pagina testada (erros de console e requisicoes) e seu texto para bugs/evidencias.
 * Modulo PURO. Evento: { t, type: 'console'|'error'|'rejection'|'request', level?, message?, method?, url?, status?, ms? }
 */

const SENSITIVE_KEYS = /^(token|access_token|id_token|refresh_token|key|apikey|api_key|password|senha|secret|auth|authorization|code|session|sid|signature|sig)$/i;
const MAX_MESSAGE = 300;
const MAX_URL = 200;

/** Mascara valores sensiveis da query string (tokens, senhas...). */
export function redactUrl(url) {
    const raw = String(url || '');
    const q = raw.indexOf('?');
    if (q < 0) return raw;
    const hash = raw.indexOf('#', q);
    const query = raw.slice(q + 1, hash < 0 ? undefined : hash);
    const masked = query.split('&').map((pair) => {
        const eq = pair.indexOf('=');
        if (eq < 0) return pair;
        const key = pair.slice(0, eq);
        return SENSITIVE_KEYS.test(decodeURIComponentSafe(key)) ? `${key}=***` : pair;
    }).join('&');
    return raw.slice(0, q + 1) + masked + (hash < 0 ? '' : raw.slice(hash));
}

function decodeURIComponentSafe(s) {
    try { return decodeURIComponent(s); } catch { return s; }
}

const clip = (s, n) => (String(s).length > n ? `${String(s).slice(0, n - 3)}...` : String(s));

export function isFailedRequest(e) {
    return e.type === 'request' && (e.status === 0 || e.status >= 400);
}

/** Eventos que valem ser mostrados: erros/avisos de console, excecoes e requisicoes com falha. */
export function isNoteworthy(e) {
    if (e.type === 'error' || e.type === 'rejection') return true;
    if (e.type === 'console') return e.level === 'error' || e.level === 'warn';
    return isFailedRequest(e);
}

export function selectRelevant(events = [], { sinceMs = 0, max = 30 } = {}) {
    return events.filter((e) => e.t >= sinceMs && isNoteworthy(e)).slice(-max);
}

export function summarizeProbe(events = []) {
    let errors = 0;
    let warnings = 0;
    let failedRequests = 0;
    events.forEach((e) => {
        if (e.type === 'error' || e.type === 'rejection' || (e.type === 'console' && e.level === 'error')) errors += 1;
        else if (e.type === 'console' && e.level === 'warn') warnings += 1;
        else if (isFailedRequest(e)) failedRequests += 1;
    });
    return { errors, warnings, failedRequests };
}

export function eventLine(e, fmtTime = (t) => String(t)) {
    const time = fmtTime(e.t);
    if (e.type === 'request') {
        const status = e.status === 0 ? 'falha de rede' : e.status;
        return `[${time}] ${e.method || 'GET'} ${clip(redactUrl(e.url), MAX_URL)} -> ${status}${Number.isFinite(e.ms) ? ` (${Math.round(e.ms)} ms)` : ''}`;
    }
    const label = e.type === 'console' ? `console.${e.level || 'log'}` : e.type === 'rejection' ? 'promise rejeitada' : 'erro';
    return `[${time}] ${label}: ${clip(e.message || '', MAX_MESSAGE)}`;
}

/** Texto com uma linha por evento; linhas consecutivas identicas viram "(xN)". */
export function formatProbeEvents(events = [], fmtTime) {
    const lines = [];
    let prev = null;
    let count = 0;
    const flush = () => { if (prev !== null) lines.push(count > 1 ? `${prev} (x${count})` : prev); };
    events.forEach((e) => {
        const line = eventLine(e, fmtTime);
        const body = line.replace(/^\[[^\]]*\]\s*/, '');
        if (prev !== null && prev.replace(/^\[[^\]]*\]\s*/, '') === body) { count += 1; return; }
        flush();
        prev = line;
        count = 1;
    });
    flush();
    return lines.join('\n');
}

// ------------------------------------------------------------- painel Console

export const PROBE_FILTERS = Object.freeze({ ALL: 'all', ERRORS: 'errors', WARNINGS: 'warnings', NETWORK: 'network' });

/** 'error' (erros de JS: console.error, excecoes, promises rejeitadas) | 'warning' | 'network'. */
export function eventCategory(e) {
    if (e.type === 'request') return 'network';
    if (e.type === 'console' && e.level === 'warn') return 'warning';
    return 'error';
}

export function countByCategory(events = []) {
    const counts = { all: events.length, errors: 0, warnings: 0, network: 0 };
    events.forEach((e) => {
        const c = eventCategory(e);
        if (c === 'error') counts.errors += 1;
        else if (c === 'warning') counts.warnings += 1;
        else counts.network += 1;
    });
    return counts;
}

/** Texto curto do tipo de evento, para a etiqueta da linha. */
export function eventTag(e) {
    if (e.type === 'request') return 'REDE';
    if (e.type === 'error') return 'EXCEÇÃO';
    if (e.type === 'rejection') return 'PROMISE';
    return e.level === 'warn' ? 'AVISO' : 'ERRO';
}

/** Linha de resumo do evento (URL ja com valores sensiveis mascarados). */
export function eventSummary(e) {
    if (e.type === 'request') {
        const status = e.status === 0 ? 'falha de rede' : e.status;
        return `${e.method || 'GET'} ${clip(redactUrl(e.url), MAX_URL)} -> ${status}`;
    }
    return clip(e.message || '', MAX_MESSAGE);
}

/** Texto completo para o detalhe expandido. */
export function eventDetail(e) {
    if (e.type === 'request') {
        const lines = [`Método: ${e.method || 'GET'}`, `URL: ${redactUrl(e.url)}`, `Status: ${e.status === 0 ? 'falha de rede (sem resposta)' : e.status}`];
        if (Number.isFinite(e.ms)) lines.push(`Duração: ${Math.round(e.ms)} ms`);
        return lines.join('\n');
    }
    return String(e.message || '');
}

/**
 * Filtra por categoria, texto (sem diferenciar maiusculas; busca no resumo e no detalhe) e instante inicial
 * (`sinceMs`, usado por "Limpar", que so esconde o que veio antes).
 */
export function filterEvents(events = [], { filter = PROBE_FILTERS.ALL, query = '', sinceMs = 0 } = {}) {
    const q = String(query || '').trim().toLowerCase();
    return events.filter((e) => {
        if (e.t < sinceMs) return false;
        const c = eventCategory(e);
        if (filter === PROBE_FILTERS.ERRORS && c !== 'error') return false;
        if (filter === PROBE_FILTERS.WARNINGS && c !== 'warning') return false;
        if (filter === PROBE_FILTERS.NETWORK && c !== 'network') return false;
        if (!q) return true;
        return `${eventSummary(e)}\n${eventDetail(e)}`.toLowerCase().includes(q);
    });
}

/** Quantos eventos "ruins" (erros e rede) chegaram depois de `sinceMs` (contador do botao). */
export function unseenCount(events = [], sinceMs = 0) {
    return events.filter((e) => e.t > sinceMs && eventCategory(e) !== 'warning').length;
}
