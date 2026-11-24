/*
 * Timers e resumo da execucao do runner. Modulo PURO: o instante atual (`now`, em ms)
 * e sempre injetado pelo chamador, o que mantem tudo determinista e testavel.
 *
 * Timer: { elapsedMs, startedAt }  (startedAt = null quando pausado)
 */

export function createTimer() {
    return { elapsedMs: 0, startedAt: null };
}

export const isRunning = (t) => t.startedAt !== null;

export function timerElapsed(t, now) {
    return t.elapsedMs + (t.startedAt === null ? 0 : Math.max(0, now - t.startedAt));
}

export function timerStart(t, now) {
    return t.startedAt === null ? { elapsedMs: t.elapsedMs, startedAt: now } : t;
}

export function timerPause(t, now) {
    return t.startedAt === null ? t : { elapsedMs: timerElapsed(t, now), startedAt: null };
}

export function timerReset() {
    return createTimer();
}

/** 65000 -> "01:05"; 3725000 -> "1:02:05". */
export function formatDuration(ms) {
    const total = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const mm = String(m).padStart(2, '0');
    const ss = String(s).padStart(2, '0');
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export const OUTCOMES = Object.freeze({
    PASSED: 'Passed',
    FAILED: 'Failed',
    BLOCKED: 'Blocked',
    PAUSED: 'Paused',
    NOT_APPLICABLE: 'NotApplicable'
});

/**
 * Conta resultados por situacao.
 * @param {Array<{id: number|string}>} testCases
 * @param {Record<string, string>} finalOutcomes  tcId -> outcome gravado
 * @param {number} currentIndex  indice do CT em execucao (os demais pendentes contam como "pending")
 */
export function summarizeRun(testCases, finalOutcomes = {}, currentIndex = 0) {
    const summary = { total: testCases.length, passed: 0, failed: 0, blocked: 0, other: 0, pending: 0, done: 0 };
    testCases.forEach((tc) => {
        const outcome = finalOutcomes[tc.id];
        if (!outcome || outcome === 'None') { summary.pending += 1; return; }
        summary.done += 1;
        if (outcome === OUTCOMES.PASSED) summary.passed += 1;
        else if (outcome === OUTCOMES.FAILED) summary.failed += 1;
        else if (outcome === OUTCOMES.BLOCKED) summary.blocked += 1;
        else summary.other += 1;
    });
    summary.percent = summary.total === 0 ? 0 : Math.round((summary.done / summary.total) * 100);
    summary.currentIndex = currentIndex;
    return summary;
}

/** Primeiro passo ainda sem resultado (o "passo atual"), ou -1 se todos tem resultado. */
export function currentStepIndex(stepResults = []) {
    return stepResults.findIndex((s) => !s.outcome || s.outcome === 'None');
}

/**
 * O que a bolinha do runner (janela minimizada) exibe.
 * idle: sem run em andamento (icone de play); running: tempo do CT; paused: icone de pausa.
 */
export function bubbleStatus({ active, paused, ctMs = 0, runMs = 0 }) {
    if (!active) return { mode: 'idle', label: '', title: 'Abrir Test Runner' };
    if (paused) {
        return {
            mode: 'paused',
            label: '',
            title: `Teste pausado em ${formatDuration(ctMs)} (CT atual). Clique para abrir e retomar.`
        };
    }
    return {
        mode: 'running',
        label: formatDuration(ctMs),
        title: `CT atual: ${formatDuration(ctMs)} | Total: ${formatDuration(runMs)}. Clique para abrir o runner.`
    };
}
