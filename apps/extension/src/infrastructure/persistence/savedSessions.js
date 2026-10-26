import { qualiflowBridge } from '../browser/callbackBridge.js';

// Chave de storage das sessoes locais pendentes de revisao. Nao alterar: mantem compatibilidade
// com sessoes ja salvas pelos usuarios. Formato: { [workItemId]: SavedSession }.
export const SAVED_SESSIONS_KEY = 'qualiflowSavedSessions';

export function loadSavedSessions(callback) {
    qualiflowBridge.getStorage([SAVED_SESSIONS_KEY], (res) => {
        callback((res && res[SAVED_SESSIONS_KEY]) || {});
    });
}

export function saveSavedSessions(sessions, callback) {
    qualiflowBridge.setStorage({ [SAVED_SESSIONS_KEY]: sessions }, callback);
}
