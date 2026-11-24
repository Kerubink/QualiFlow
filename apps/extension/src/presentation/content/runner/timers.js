/* Estado e ticker dos timers da execucao (logica pura em domain/runTimer.js). */
import { S } from './state.js';
import { logEvent } from './runLog.js';
import { createTimer, formatDuration, timerElapsed, timerPause, timerReset, timerStart } from '../../../domain/runTimer.js';

let tickHandle = null;
const tickListeners = new Set();

/** Registra um callback chamado a cada segundo (e quando o ticker para). */
export function onTick(fn) { tickListeners.add(fn); }

/** Avisa quem exibe o estado da run (bolinha, camada de pausa) que algo mudou. */
export function notifyRunStateChanged() {
    document.dispatchEvent(new CustomEvent('qualiflow:run-state'));
}


/** Garante os campos de timer em runnerState (tambem para runs retomados). */
export function ensureTimerState() {
    const st = S.runnerState;
    if (!st) return;
    if (!st.runTimer) st.runTimer = timerStart(createTimer(), Date.now());
    if (!st.ctTimers) st.ctTimers = {};
    if (!st.ctMarks) st.ctMarks = {};
    if (!st.finalOutcomes) st.finalOutcomes = {};
    if (!st.ctStartAt) st.ctStartAt = {};
    if (!st.lastMarkAt) st.lastMarkAt = {};
    if (st.paused === undefined) st.paused = false;
    if (!st.startedAt) st.startedAt = Date.now();
    if (!st.pauseCount) st.pauseCount = 0;
    if (!st.pausedMs) st.pausedMs = 0;
}

export function getCtTimer(tcId) {
    ensureTimerState();
    return S.runnerState.ctTimers[tcId] || createTimer();
}

function setCtTimer(tcId, timer) {
    S.runnerState.ctTimers[tcId] = timer;
}

/** Inicia o timer do CT na primeira exibicao; nao reinicia um timer que o usuario pausou. */
export function startCtTimerIfNew(tcId) {
    ensureTimerState();
    if (!S.runnerState.ctTimers[tcId]) {
        setCtTimer(tcId, timerStart(createTimer(), Date.now()));
        S.runnerState.ctStartAt[tcId] = Date.now();
    }
}

export function resetCtTimer(tcId) {
    setCtTimer(tcId, timerReset());
    S.runnerState.ctMarks[tcId] = 0;
}

export function pauseCtTimer(tcId) {
    setCtTimer(tcId, timerPause(getCtTimer(tcId), Date.now()));
}

export function resumeCtTimer(tcId) {
    setCtTimer(tcId, timerStart(getCtTimer(tcId), Date.now()));
}

export function ctElapsedMs(tcId) {
    return timerElapsed(getCtTimer(tcId), Date.now());
}

/**
 * Duracao do passo = tempo do CT desde a ultima marcacao (ou desde o inicio).
 * Chamar ao marcar o passo; devolve ms e avanca a marca.
 */
export function takeStepDuration(tcId) {
    ensureTimerState();
    const now = ctElapsedMs(tcId);
    const last = S.runnerState.ctMarks[tcId] || 0;
    S.runnerState.ctMarks[tcId] = now;
    return Math.max(0, now - last);
}

export function runElapsedMs() {
    ensureTimerState();
    return timerElapsed(S.runnerState.runTimer, Date.now());
}

function currentTcId() {
    const st = S.runnerState;
    return st?.testCases?.[st.currentTcIndex]?.id;
}

function tick() {
    const runEl = document.getElementById('qualiflow-run-timer');
    if (!runEl || !S.runnerState) {
        stopTicker();
        return;
    }
    runEl.textContent = formatDuration(runElapsedMs());
    const id = currentTcId();
    const ctEl = document.getElementById('qualiflow-ct-timer');
    if (ctEl && id !== undefined) ctEl.textContent = formatDuration(ctElapsedMs(id));
    tickListeners.forEach((fn) => fn());
}

export function startTicker() {
    if (tickHandle) return;
    tickHandle = setInterval(tick, 1000);
}

export function stopTicker() {
    if (tickHandle) clearInterval(tickHandle);
    tickHandle = null;
    tickListeners.forEach((fn) => fn());
}

/** Entrada em um CT (navegacao): inicia se for novo, retoma se estava pausado ao sair. */
export function enterCt(tcId) {
    ensureTimerState();
    if (!S.runnerState.ctTimers[tcId]) startCtTimerIfNew(tcId);
    else resumeCtTimer(tcId);
}

/** Saida de um CT (navegacao): pausa para nao contar o tempo gasto em outro CT. */
export function leaveCt(tcId) {
    ensureTimerState();
    pauseCtTimer(tcId);
}

// ------------------------------------------------------------------ pausa
/** Execucao pausada pelo usuario: tempo total e do CT parados e interacao bloqueada. */
export function isPaused() {
    return !!S.runnerState?.paused;
}

export function pauseRun() {
    ensureTimerState();
    const st = S.runnerState;
    if (!st || st.paused) return;
    const now = Date.now();
    st.paused = true;
    st.pauseStartedAt = now;
    st.pauseCount += 1;
    st.runTimer = timerPause(st.runTimer, now);
    const id = currentTcId();
    if (id !== undefined) pauseCtTimer(id);
    logEvent('Teste pausado');
    notifyRunStateChanged();
}

export function resumeRun() {
    ensureTimerState();
    const st = S.runnerState;
    if (!st || !st.paused) return;
    const now = Date.now();
    st.paused = false;
    if (st.pauseStartedAt) st.pausedMs += Math.max(0, now - st.pauseStartedAt);
    st.pauseStartedAt = null;
    st.runTimer = timerStart(st.runTimer, now);
    const id = currentTcId();
    if (id !== undefined) resumeCtTimer(id);
    logEvent('Teste retomado');
    notifyRunStateChanged();
}
