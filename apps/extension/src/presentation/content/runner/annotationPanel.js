

export function openAnnotationPanel(srcDataUrl, onSave) {
    const opener = document.activeElement;
    const panel = document.createElement('div');
    panel.id = 'qualiflow-annotation-panel';
    panel.className = 'qualiflow-root qualiflow-run-annot';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'qa-title');

    panel.innerHTML = `
      <div class="qualiflow-run-annot-bar">
        <span id="qa-title" class="qualiflow-run-annot-title">✏️ Anotação</span>
        <div class="qualiflow-run-annot-tools">
          <button type="button" id="qa-tool-pen" class="qualiflow-btn-inline qualiflow-btn-sm qualiflow-run-annot-tool is-active" aria-pressed="true">Caneta</button>
          <button type="button" id="qa-tool-rect" class="qualiflow-btn-inline qualiflow-btn-sm qualiflow-run-annot-tool" aria-pressed="false">Retângulo</button>
          <button type="button" id="qa-tool-arrow" class="qualiflow-btn-inline qualiflow-btn-sm qualiflow-run-annot-tool" aria-pressed="false">Seta</button>
          <button type="button" id="qa-tool-text" class="qualiflow-btn-inline qualiflow-btn-sm qualiflow-run-annot-tool" aria-pressed="false">Texto</button>
        </div>
        <input id="qa-color" class="qualiflow-run-annot-color" type="color" value="#ef4444" title="Cor" aria-label="Cor">
        <input id="qa-size" class="qualiflow-run-annot-size" type="range" min="1" max="12" value="3" title="Espessura" aria-label="Espessura">
        <button type="button" id="qa-undo" class="qualiflow-btn-inline qualiflow-btn-sm qualiflow-run-annot-tool">↩ Desfazer</button>
        <div class="qualiflow-u-grow"></div>
        <button type="button" id="qa-cancel" class="qualiflow-btn-inline qualiflow-btn-sm qualiflow-run-btn-danger-outline">Cancelar</button>
        <button type="button" id="qa-save" class="qualiflow-btn-inline qualiflow-btn-sm qualiflow-btn-success">Salvar e anexar</button>
      </div>
      <div class="qualiflow-run-annot-stage">
        <canvas id="qa-canvas" class="qualiflow-run-annot-canvas" aria-label="Área de anotação da captura de tela"></canvas>
      </div>
    `;
    document.body.appendChild(panel);

    const closeAnnotation = (result) => {
        document.removeEventListener('keydown', onKeydown);
        panel.remove();
        onSave(result);
        if (!result && opener && opener.isConnected && typeof opener.focus === 'function') opener.focus();
    };
    function onKeydown(e) {
        if (e.key === 'Escape') closeAnnotation(null);
    }
    document.addEventListener('keydown', onKeydown);
    panel.querySelector('#qa-tool-pen').focus();

    const canvas = panel.querySelector('#qa-canvas');
    // willReadFrequently: undo uses getImageData repeatedly
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const img = new Image();
    img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
    };
    img.src = srcDataUrl;

    let tool = 'pen', color = '#ef4444', size = 3;
    let drawing = false, startX, startY;
    const history = [];

    const saveState = () => history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));

    const getPos = (e) => {
        const r = canvas.getBoundingClientRect();
        const scaleX = canvas.width / r.width;
        const scaleY = canvas.height / r.height;
        const src = e.touches ? e.touches[0] : e;
        return { x: (src.clientX - r.left) * scaleX, y: (src.clientY - r.top) * scaleY };
    };

    canvas.addEventListener('pointerdown', (e) => {
        drawing = true; saveState();
        const p = getPos(e); startX = p.x; startY = p.y;
        if (tool === 'pen') { ctx.beginPath(); ctx.moveTo(p.x, p.y); }
        if (tool === 'text') {
            const txt = prompt('Texto:');
            if (txt) { ctx.fillStyle = color; ctx.font = `${size * 6}px sans-serif`; ctx.fillText(txt, p.x, p.y); }
            drawing = false;
        }
    });

    canvas.addEventListener('pointermove', (e) => {
        if (!drawing) return;
        const p = getPos(e);
        if (tool === 'pen') {
            ctx.strokeStyle = color; ctx.lineWidth = size; ctx.lineCap = 'round';
            ctx.lineTo(p.x, p.y); ctx.stroke();
        }
    });

    const finishDraw = (e) => {
        if (!drawing) return; drawing = false;
        const p = getPos(e);
        ctx.strokeStyle = color; ctx.lineWidth = size;
        if (tool === 'rect') {
            ctx.strokeRect(startX, startY, p.x - startX, p.y - startY);
        } else if (tool === 'arrow') {
            ctx.beginPath(); ctx.moveTo(startX, startY); ctx.lineTo(p.x, p.y); ctx.stroke();
            // arrowhead
            const angle = Math.atan2(p.y - startY, p.x - startX);
            const len = 16;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x - len * Math.cos(angle - 0.4), p.y - len * Math.sin(angle - 0.4));
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x - len * Math.cos(angle + 0.4), p.y - len * Math.sin(angle + 0.4));
            ctx.stroke();
        }
    };
    canvas.addEventListener('pointerup', finishDraw);
    canvas.addEventListener('pointerleave', finishDraw);

    // Tool buttons
    ['pen', 'rect', 'arrow', 'text'].forEach(t => {
        panel.querySelector(`#qa-tool-${t}`).onclick = () => {
            tool = t;
            ['pen', 'rect', 'arrow', 'text'].forEach(x => {
                const btn = panel.querySelector(`#qa-tool-${x}`);
                btn.classList.toggle('is-active', x === t);
                btn.setAttribute('aria-pressed', x === t ? 'true' : 'false');
            });
        };
    });
    panel.querySelector('#qa-color').oninput = (e) => color = e.target.value;
    panel.querySelector('#qa-size').oninput = (e) => size = parseInt(e.target.value);
    panel.querySelector('#qa-undo').onclick = () => { if (history.length) ctx.putImageData(history.pop(), 0, 0); };
    panel.querySelector('#qa-cancel').onclick = () => {
        closeAnnotation(null); // restore UI without adding evidence
    };
    panel.querySelector('#qa-save').onclick = () => {
        const annotated = canvas.toDataURL('image/png');
        closeAnnotation(annotated);
    };
}
