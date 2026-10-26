// Helpers de UI da pagina de configuracoes (mensagem de status e variantes de status).

const STATUS_TYPES = ['info', 'success', 'warn', 'error'];

export function showStatus(message, type) {
    const statusEl = document.getElementById('status-message');
    statusEl.textContent = message;
    statusEl.className = `status-message ${type}`;

    setTimeout(() => {
        statusEl.className = 'status-message';
        statusEl.textContent = '';
    }, 3000);
}

// Escreve texto num elemento de status com a variante do tipo (info por padrao).
export function setStatusText(statusEl, message, type = 'info') {
    if (!statusEl) return;
    statusEl.textContent = message;
    const variant = STATUS_TYPES.includes(type) ? type : 'info';
    STATUS_TYPES.forEach((t) => statusEl.classList.toggle(`is-${t}`, t === variant));
}

export function setCopilotAuthStatus(message, type = 'info') {
    setStatusText(document.getElementById('copilot-auth-status'), message, type);
}

export function setBoardAuthStatus(provider, message, type = 'info') {
    setStatusText(document.getElementById(`${provider}-auth-status`), message, type);
}
