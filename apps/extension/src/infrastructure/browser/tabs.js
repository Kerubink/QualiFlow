export function openTab(url) {
    return chrome.tabs.create({ url });
}

// Captura a aba visivel (so o background pode fazer isso). Resolve { dataUrl } ou { error }.
export function captureActiveTab() {
    return new Promise((resolve) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tabId = tabs[0]?.id;
            if (!tabId) {
                resolve({ error: 'Nenhuma aba ativa.' });
                return;
            }
            chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
                if (chrome.runtime.lastError) {
                    resolve({ error: chrome.runtime.lastError.message });
                } else {
                    resolve({ dataUrl });
                }
            });
        });
    });
}
