/*
 * Persistencia da run: serializa o estado do runner para storage e o restaura depois de um recarregamento.
 * Modulo PURO. Regras:
 *  - blobs e videos nao sao salvos; imagens so se ainda NAO foram enviadas ao Azure (para permitir reenvio);
 *  - ao restaurar, os cronometros voltam PAUSADOS (o tempo fora da pagina nao conta) e o QA retoma manualmente;
 *  - envios que estavam em andamento viram "erro" (reenviaveis quando a imagem foi guardada).
 */
import { timerElapsed } from './runTimer.js';

export const SNAPSHOT_VERSION = 1;
export const SNAPSHOT_MAX_AGE_MS = 12 * 60 * 60 * 1000;
export const SNAPSHOT_MAX_IMAGE_CHARS = 1_500_000;

const frozen = (timer, now) => ({ elapsedMs: timerElapsed(timer || { elapsedMs: 0, startedAt: null }, now), startedAt: null });

function serializeEvidence(ev) {
    const out = { name: ev.name, type: ev.type, status: ev.status, error: ev.error, azureId: ev.azureId };
    const keepImage = ev.status !== 'uploaded'
        && String(ev.type || '').startsWith('image/')
        && typeof ev.dataUrl === 'string'
        && ev.dataUrl.startsWith('data:')
        && ev.dataUrl.length <= SNAPSHOT_MAX_IMAGE_CHARS;
    if (keepImage) out.dataUrl = ev.dataUrl;
    return out;
}

export function isRunInProgress(state) {
    return !!(state && state.runId && Array.isArray(state.testCases) && state.currentTcIndex < state.testCases.length);
}

export function serializeRun(state, { now = Date.now(), workItemId, notes = '' } = {}) {
    const evidences = {};
    Object.entries(state.evidences || {}).forEach(([key, list]) => {
        if (list && list.length) evidences[key] = list.map(serializeEvidence);
    });
    const ctTimers = {};
    Object.entries(state.ctTimers || {}).forEach(([id, t]) => { ctTimers[id] = frozen(t, now); });
    return {
        version: SNAPSHOT_VERSION,
        savedAt: now,
        workItemId,
        runId: state.runId,
        currentTcIndex: state.currentTcIndex,
        testCases: state.testCases,
        results: state.results || [],
        stepResults: state.stepResults || {},
        overallOutcomes: state.overallOutcomes || {},
        comments: state.comments || {},
        commentVisible: state.commentVisible || {},
        finalOutcomes: state.finalOutcomes || {},
        ctDurations: state.ctDurations || {},
        ctMarks: state.ctMarks || {},
        runTimer: frozen(state.runTimer, now),
        ctTimers,
        events: state.events || [],
        bugs: state.bugs || [],
        pauseCount: state.pauseCount || 0,
        pausedMs: state.pausedMs || 0,
        startedAt: state.startedAt || now,
        notes,
        evidences
    };
}

export function isRestorable(snapshot, { workItemId, now = Date.now() } = {}) {
    if (!snapshot || snapshot.version !== SNAPSHOT_VERSION) return false;
    if (!snapshot.runId || !Array.isArray(snapshot.testCases) || snapshot.testCases.length === 0) return false;
    if (snapshot.currentTcIndex >= snapshot.testCases.length) return false;
    if (workItemId !== undefined && String(snapshot.workItemId) !== String(workItemId)) return false;
    return now - snapshot.savedAt <= SNAPSHOT_MAX_AGE_MS;
}

export function restoreRun(snapshot, now = Date.now()) {
    const evidences = {};
    Object.entries(snapshot.evidences || {}).forEach(([key, list]) => {
        evidences[key] = list.map((ev) => {
            const restored = { ...ev };
            if (restored.status === 'uploading' || restored.status === 'pending') {
                restored.status = 'error';
                restored.error = restored.dataUrl
                    ? 'Envio interrompido pelo recarregamento da página. Use Reenviar.'
                    : 'Arquivo indisponível após o recarregamento da página.';
            }
            return restored;
        });
    });
    const events = [...(snapshot.events || []), { at: now, text: 'Execução restaurada após recarregar a página (retome para continuar)' }];
    return {
        testCases: snapshot.testCases,
        currentTcIndex: snapshot.currentTcIndex,
        runId: snapshot.runId,
        results: snapshot.results,
        stepResults: snapshot.stepResults,
        overallOutcomes: snapshot.overallOutcomes,
        comments: snapshot.comments,
        commentVisible: snapshot.commentVisible,
        finalOutcomes: snapshot.finalOutcomes,
        ctDurations: snapshot.ctDurations,
        ctMarks: snapshot.ctMarks,
        runTimer: { ...snapshot.runTimer, startedAt: null },
        ctTimers: snapshot.ctTimers,
        events,
        bugs: snapshot.bugs,
        pauseCount: snapshot.pauseCount,
        pausedMs: snapshot.pausedMs,
        startedAt: snapshot.startedAt,
        paused: true,
        pauseStartedAt: now,
        evidences
    };
}
