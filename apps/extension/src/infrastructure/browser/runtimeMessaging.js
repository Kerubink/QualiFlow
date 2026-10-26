export function sendRuntimeMessage(message) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
            }
            resolve(response);
        });
    });
}

// Chamada barata a uma API de extensao: reinicia o timer de inatividade (30s) do service worker MV3.
export function keepServiceWorkerAlive() {
    return chrome.runtime.getPlatformInfo();
}

export function sendMessageToTab(tabId, message) {
    return chrome.tabs.sendMessage(tabId, message);
}