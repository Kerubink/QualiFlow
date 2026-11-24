/*
 * Cliente da sonda de console/rede: pede ao background para injetar a sonda no contexto da pagina e
 * guarda os eventos recebidos (so campos conhecidos, com tamanhos limitados: a pagina e nao confiavel).
 */
import { sendRuntimeMessage } from '../shared/runtime.js';
import { RuntimeActions } from '../../../contracts/runtimeActions.js';
import { S } from './state.js';
import { selectRelevant, summarizeProbe, isNoteworthy } from '../../../domain/probeEvents.js';

const MAX_EVENTS = 300;
const TYPES = new Set(['console', 'error', 'rejection', 'request']);
let listening = false;
let active = false;
let seq = 0;

const str = (v, n) => String(v ?? '').slice(0, n);

function onMessage(e) {
    if (e.source !== window) return;
    const data = e.data;
    if (!data || data.source !== 'qualiflow-probe' || !data.event || !S.probeEnabled) return;
    const ev = data.event;
    if (!TYPES.has(ev.type)) return;
    const clean = { id: ++seq, t: Number.isFinite(ev.t) ? ev.t : Date.now(), type: ev.type };
    if (ev.type === 'request') {
        clean.method = str(ev.method, 12).toUpperCase();
        clean.url = str(ev.url, 500);
        clean.status = Number.isFinite(ev.status) ? ev.status : 0;
        clean.ms = Number.isFinite(ev.ms) ? ev.ms : undefined;
    } else {
        clean.level = ev.level === 'warn' ? 'warn' : 'error';
        clean.message = str(ev.message, 500);
    }
    S.probeEvents.push(clean);
    if (S.probeEvents.length > MAX_EVENTS) S.probeEvents.shift();
    document.dispatchEvent(new CustomEvent('qualiflow:probe-event'));
}

/** Comeca a ouvir e injeta a sonda na pagina (idempotente). */
export function startProbe() {
    if (!listening) {
        window.addEventListener('message', onMessage);
        listening = true;
    }
    active = true;
    sendRuntimeMessage({ action: RuntimeActions.INSTALL_PAGE_PROBE }, () => {});
}

/** A sonda ja foi pedida nesta pagina (a injecao em si e idempotente). */
export function isProbeActive() {
    return active;
}

export function probeSince(sinceMs) {
    return selectRelevant(S.probeEvents, { sinceMs, max: 30 });
}

export function probeSummary() {
    return summarizeProbe(S.probeEvents.filter(isNoteworthy));
}

export function clearProbe() {
    S.probeEvents.length = 0;
    document.dispatchEvent(new CustomEvent('qualiflow:probe-event'));
}
