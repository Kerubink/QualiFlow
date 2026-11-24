/*
 * Persistencia da run em chrome.storage (sobrevive a recarregamento/navegacao da pagina testada).
 * Salva a cada poucos segundos e ao sair da pagina; ao reabrir o runner, oferece retomar.
 * Logica de serializacao/validacao em domain/runSnapshot.js.
 */
import { getStorage, removeStorage, setStorage } from '../shared/runtime.js';
import { S } from './state.js';
import { isRestorable, isRunInProgress, restoreRun, serializeRun } from '../../../domain/runSnapshot.js';
import { ensureTimerState, notifyRunStateChanged, onTick, resumeRun } from './timers.js';
import { startProbe } from './probeClient.js';

const KEY = 'runnerRunSnapshot';
const MAX_JSON_CHARS = 7_000_000; // chrome.storage.local ~10 MB
const SAVE_EVERY_TICKS = 3;
let ticks = 0;
let wired = false;

export function persistRunNow() {
    const st = S.runnerState;
    if (!isRunInProgress(st) || !S.activeSession) return;
    const snap = serializeRun(st, { workItemId: S.activeSession.workItemId, notes: S.hubNotes });
    if (JSON.stringify(snap).length > MAX_JSON_CHARS) {
        Object.values(snap.evidences).forEach((list) => list.forEach((ev) => { delete ev.dataUrl; }));
    }
    setStorage({ [KEY]: snap });
}

export function clearPersistedRun(cb) {
    removeStorage(KEY, cb);
}

/** Chama cb(snapshot) se houver uma run salva compativel com o PBI da sessao; senao cb(null). */
export function readRestorable(workItemId, cb) {
    getStorage([KEY], (data) => {
        const snap = data[KEY];
        cb(isRestorable(snap, { workItemId }) ? snap : null);
    });
}

/** Restaura o estado e retoma a execucao (o QA ja confirmou ao clicar em "Retomar execucao"). */
export function restoreFromSnapshot(snap) {
    S.runnerState = restoreRun(snap);
    S.hubNotes = snap.notes || '';
    ensureTimerState();
    startProbe();
    resumeRun();
    notifyRunStateChanged();
}

export function initRunStore() {
    if (wired) return;
    wired = true;
    onTick(() => {
        ticks += 1;
        if (ticks % SAVE_EVERY_TICKS === 0) persistRunNow();
    });
    window.addEventListener('pagehide', persistRunNow);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') persistRunNow(); });
}
