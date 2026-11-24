/* Registro de atividade da execucao (alimenta o HUB). Vive em runnerState, so em memoria. */
import { S } from './state.js';

const MAX_EVENTS = 200;

export function logEvent(text) {
    const st = S.runnerState;
    if (!st) return;
    if (!st.events) st.events = [];
    st.events.push({ at: Date.now(), text });
    if (st.events.length > MAX_EVENTS) st.events.shift();
}

export function recordBug(bugId, tcId) {
    const st = S.runnerState;
    if (!st) return;
    if (!st.bugs) st.bugs = [];
    st.bugs.push({ id: bugId, tcId });
    logEvent(`Bug #${bugId} criado (CT #${tcId})`);
}
