// Roteador de mensagens de runtime: despacha request.action para o handler registrado.
// Todo handler e `async (request, ctx) => resposta`; excecoes viram `{ error: message }`.

export function createMessageRouter(handlers) {
    return function onMessage(request, sender, sendResponse) {
        const handler = handlers[request?.action];
        if (!handler) return false;

        Promise.resolve()
            .then(() => handler(request, { sender }))
            .then(sendResponse)
            .catch((err) => sendResponse({ error: err.message }));

        return true; // mantem o canal aberto para a resposta assincrona
    };
}

// Junta os registros de handlers de cada grupo, recusando actions duplicadas.
export function mergeHandlers(...groups) {
    const merged = {};
    for (const group of groups) {
        for (const [action, handler] of Object.entries(group)) {
            if (merged[action]) throw new Error(`Handler duplicado para a action ${action}.`);
            merged[action] = handler;
        }
    }
    return merged;
}
