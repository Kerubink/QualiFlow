/* Avisos curtos e nao bloqueantes no canto da tela (funcionam mesmo com o runner minimizado). */
const CONTAINER_ID = 'qualiflow-toasts';

export function showToast(text, { kind = 'info', timeout = 6000 } = {}) {
    let box = document.getElementById(CONTAINER_ID);
    if (!box) {
        box = document.createElement('div');
        box.id = CONTAINER_ID;
        box.className = 'qualiflow-root qualiflow-toasts';
        document.body.appendChild(box);
    }
    const item = document.createElement('div');
    item.className = `qualiflow-toast is-${kind}`;
    item.setAttribute('role', kind === 'error' || kind === 'warn' ? 'alert' : 'status');
    const span = document.createElement('span');
    span.textContent = text;
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'qualiflow-toast-close';
    close.setAttribute('aria-label', 'Fechar aviso');
    close.innerHTML = '&times;';
    const remove = () => { item.remove(); if (!box.childElementCount) box.remove(); };
    close.addEventListener('click', remove);
    item.append(span, close);
    box.appendChild(item);
    if (timeout) setTimeout(remove, timeout);
}
