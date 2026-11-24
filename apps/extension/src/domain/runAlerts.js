/* Regras dos alertas de tempo do runner. Modulo PURO. */
import { averageMs } from './runInsights.js';

export const SLOW_STEP_FACTOR = 2;
export const SLOW_STEP_MIN_MS = 60_000;
export const PAUSE_REMINDER_MS = 5 * 60_000;

/** Media dos tempos de passo ja registrados; null sem dados. */
export function averageStepMs(stepDurations = []) {
    return averageMs(stepDurations);
}

/** Passo "demorado": passou de `factor` x a media (e de pelo menos `minMs`, para nao alertar por passos curtos). */
export function isSlowStep({ sinceMarkMs, avgStepMs, factor = SLOW_STEP_FACTOR, minMs = SLOW_STEP_MIN_MS }) {
    if (avgStepMs === null || avgStepMs === undefined || !Number.isFinite(sinceMarkMs)) return false;
    return sinceMarkMs >= Math.max(minMs, avgStepMs * factor);
}

export function isLongPause({ pausedForMs, limitMs = PAUSE_REMINDER_MS }) {
    return Number.isFinite(pausedForMs) && pausedForMs >= limitMs;
}
