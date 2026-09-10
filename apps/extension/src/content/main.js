// Observe URL changes (SPA router)
let lastUrl = location.href;
new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
        lastUrl = url;
    }
}).observe(document, { subtree: true, childList: true });

// Init
function init() {
    const fn = globalThis.injectFAB;
    if (typeof fn === 'function') {
        fn();
        return;
    }

    // Fallback defensivo para cenarios de ordem de carga/chunks no build.
    let retries = 0;
    const maxRetries = 12;
    const timer = setInterval(() => {
        const delayedFn = globalThis.injectFAB;
        if (typeof delayedFn === 'function') {
            clearInterval(timer);
            delayedFn();
            return;
        }
        retries += 1;
        if (retries >= maxRetries) {
            clearInterval(timer);
            console.error('[QualiFlow] injectFAB indisponivel apos bootstrap.');
        }
    }, 150);
}
init();
