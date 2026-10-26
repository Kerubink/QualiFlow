import { qualiflowBridge } from '../../../infrastructure/browser/callbackBridge.js';

// Envia mensagem ao background. Com callback: estilo callback ({ error } em falha).
// Sem callback: retorna Promise que rejeita quando a resposta traz `error`.
export function sendRuntimeMessage(message, callback) {
    if (typeof callback === 'function') {
        qualiflowBridge.sendRuntimeMessage(message, callback);
        return undefined;
    }

    return new Promise((resolve, reject) => {
        qualiflowBridge.sendRuntimeMessage(message, (response) => {
            if (response && response.error) {
                reject(new Error(response.error));
                return;
            }
            resolve(response);
        });
    });
}

export function getStorage(keys, callback) {
    qualiflowBridge.getStorage(keys, callback);
}

export function setStorage(payload, callback) {
    qualiflowBridge.setStorage(payload, callback);
}

export function removeStorage(keys, callback) {
    qualiflowBridge.removeStorage(keys, callback);
}
