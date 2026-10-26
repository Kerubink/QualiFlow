export function getLocalStorage(keys) {
    return new Promise((resolve) => {
        chrome.storage.local.get(keys, resolve);
    });
}

export function setLocalStorage(payload) {
    return new Promise((resolve) => {
        chrome.storage.local.set(payload, resolve);
    });
}