(function () {
    if (window.qualiflowBridge) return;

    window.qualiflowBridge = {
        getStorage(keys, callback) {
            chrome.storage.local.get(keys, (data) => {
                if (typeof callback === 'function') callback(data);
            });
        },

        setStorage(payload, callback) {
            chrome.storage.local.set(payload, () => {
                if (typeof callback === 'function') callback();
            });
        },

        removeStorage(keys, callback) {
            chrome.storage.local.remove(keys, () => {
                if (typeof callback === 'function') callback();
            });
        },

        sendRuntimeMessage(message, callback) {
            chrome.runtime.sendMessage(message, (response) => {
                if (chrome.runtime.lastError) {
                    if (typeof callback === 'function') {
                        callback({ error: chrome.runtime.lastError.message });
                    }
                    return;
                }

                if (typeof callback === 'function') callback(response);
            });
        }
    };
})();