import { sendRuntimeMessage as sendRuntimeMessageBridge } from '../../infrastructure/browser/runtimeMessaging.js';
import { getLocalStorage, setLocalStorage } from '../../infrastructure/browser/storage.js';

export function sendRuntimeMessage(message, callback) {
    sendRuntimeMessageBridge(message)
        .then((response) => callback(response))
        .catch((error) => callback({ success: false, error: error.message }));
}

// Envia mensagem e rejeita quando a resposta nao traz success.
export function requestOrReject(message, fallbackError) {
    return new Promise((resolve, reject) => {
        sendRuntimeMessage(message, (response) => {
            if (!response?.success) {
                reject(new Error(response?.error || fallbackError));
                return;
            }
            resolve(response);
        });
    });
}

export function getStorage(keys, callback) {
    getLocalStorage(keys).then((data) => callback(data));
}

export function setStorage(payload, callback) {
    setLocalStorage(payload).then(() => {
        if (typeof callback === 'function') callback();
    });
}
