export function safeGetElement(id) {
    const el = document.getElementById(id);
    if (!el) {
        console.warn(`Elemento não encontrado: ${id}`);
    }
    return el;
}

// Escapa texto vindo de board/IA antes de interpolar em innerHTML.
export function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
