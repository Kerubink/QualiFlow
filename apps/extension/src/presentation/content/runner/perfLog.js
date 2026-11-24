/*
 * Historico de desempenho: quando ligado, registra as metricas a cada carregamento de pagina durante a execucao
 * (o runner e reinjetado em cada carga). Guarda so metricas, URL sem query e hora, no maximo 30 entradas.
 */
import { getStorage, setStorage } from '../shared/runtime.js';
import { collectPerformance } from './uiTools.js';
import { appendPerfEntry } from '../../../domain/uiInsights.js';

const LOG_KEY = 'runnerPerfLog';
const AUTO_KEY = 'runnerPerfAuto';
const SETTLE_MS = 2500; // tempo para o LCP estabilizar depois do load

export function isPerfAutoStored(data) {
    return data?.[AUTO_KEY] === true;
}

export function setPerfAuto(on) {
    setStorage({ [AUTO_KEY]: !!on });
}

export function readPerfLog(callback) {
    getStorage([LOG_KEY], (d) => callback(Array.isArray(d[LOG_KEY]) ? d[LOG_KEY] : []));
}

export function clearPerfLog(callback) {
    setStorage({ [LOG_KEY]: [] }, callback);
}

/** Agenda o registro desta carga de pagina (chamado no bootstrap quando o historico esta ligado). */
export function startPerfAutoLog() {
    const record = () => setTimeout(() => {
        const m = collectPerformance();
        const entry = {
            at: Date.now(),
            url: `${location.origin}${location.pathname}`,
            ttfb: m.ttfb, fcp: m.fcp, lcp: m.lcp, cls: m.cls, load: m.load, resources: m.resources, transfer: m.transfer
        };
        readPerfLog((log) => setStorage({ [LOG_KEY]: appendPerfEntry(log, entry) }, () => {
            document.dispatchEvent(new CustomEvent('qualiflow:tools-changed'));
        }));
    }, SETTLE_MS);
    if (document.readyState === 'complete') record(); else window.addEventListener('load', record, { once: true });
}
