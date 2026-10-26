

export function sanitize(str) {
    if (!str) return '';
    const txt = document.createElement("textarea");
    txt.innerHTML = str;
    const decoded = txt.value;

    const div = document.createElement('div');
    div.innerText = decoded;
    return div.innerHTML;
}

export function setupDrag(w, header, hooks = {}) {
    let isDragging = false, startX, startY, initialLeft, initialTop;
    header.addEventListener('mousedown', (e) => {
        isDragging = true; startX = e.clientX; startY = e.clientY;
        initialLeft = w.getBoundingClientRect().left; initialTop = w.getBoundingClientRect().top;
        document.body.style.userSelect = 'none';
        if (typeof hooks.onStart === 'function') hooks.onStart();
    });
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        w.style.left = `${initialLeft + deltaX}px`;
        w.style.top = `${initialTop + deltaY}px`;
        w.style.bottom = 'auto'; w.style.right = 'auto';
        if (typeof hooks.onMove === 'function' && (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3)) {
            hooks.onMove();
        }
    });
    document.addEventListener('mouseup', () => {
        if (!isDragging) return;
        isDragging = false;
        document.body.style.userSelect = '';
        if (typeof hooks.onEnd === 'function') hooks.onEnd();
    });
}
