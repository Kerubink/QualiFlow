/*
 * Editor de anotacoes de capturas de tela.
 * Modelo baseado em objetos (vetorial ate exportar): cada forma pode ser selecionada,
 * movida, redimensionada, recolorida e apagada. Geometria pura em domain/annotationGeometry.js.
 */
import {
    arrowHead,
    boundsOf,
    handlesOf,
    isBox,
    isDegenerate,
    isLine,
    nextMarkerNumber,
    normalizeBox,
    pickHandle,
    pickTopmost,
    resizeByHandle,
    snapAngle,
    translate
} from '../../../domain/annotationGeometry.js';

const TOOLS = [
    { id: 'select', label: 'Selecionar', key: 'v' },
    { id: 'pen', label: 'Caneta', key: 'p' },
    { id: 'line', label: 'Linha', key: 'l' },
    { id: 'arrow', label: 'Seta', key: 'a' },
    { id: 'rect', label: 'Retângulo', key: 'r' },
    { id: 'ellipse', label: 'Elipse', key: 'e' },
    { id: 'highlight', label: 'Destaque', key: 'h' },
    { id: 'blur', label: 'Ocultar', key: 'b', hint: 'Oculta dados sensíveis (pixeliza a área)' },
    { id: 'text', label: 'Texto', key: 't' },
    { id: 'marker', label: 'Marcador', key: 'n', hint: 'Marcador numerado' },
    { id: 'crop', label: 'Recortar', key: 'c', hint: 'Recorta a imagem: arraste a área e pressione Enter (Esc cancela)' }
];
const SWATCHES = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#111827', '#ffffff'];
const ZOOM_STEPS = [0.1, 0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.5, 2, 3, 4];
const UNDO_LIMIT = 100;

// Preferencia de marca d'agua lembrada entre capturas da mesma sessao.
let watermarkPref = false;

/**
 * Editor de capturas. options.watermarkText: texto da marca d'agua opcional (CT, data/hora, URL).
 */
export function openAnnotationPanel(srcDataUrl, onSave, options = {}) {
    const opener = document.activeElement;
    const panel = document.createElement('div');
    panel.id = 'qualiflow-annotation-panel';
    panel.className = 'qualiflow-root qualiflow-run-annot';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'qa-title');

    const toolButtons = TOOLS.map((t) =>
        `<button type="button" class="qualiflow-run-annot-tool" data-tool="${t.id}" aria-pressed="false" title="${t.hint || t.label} (${t.key.toUpperCase()})">${t.label}</button>`
    ).join('');
    const swatchButtons = SWATCHES.map((c) =>
        `<button type="button" class="qualiflow-run-annot-swatch" data-color="${c}" style="--sw:${c}" aria-label="Cor ${c}" title="${c}"></button>`
    ).join('');

    panel.innerHTML = `
      <div class="qualiflow-run-annot-bar">
        <span id="qa-title" class="qualiflow-run-annot-title">Editor de captura</span>
        <div class="qualiflow-run-annot-group" role="toolbar" aria-label="Ferramentas">${toolButtons}</div>
        <div class="qualiflow-run-annot-group" aria-label="Propriedades">
          ${swatchButtons}
          <input id="qa-color" class="qualiflow-run-annot-color" type="color" value="#ef4444" title="Cor personalizada" aria-label="Cor personalizada">
          <label class="qualiflow-run-annot-field" title="Espessura / tamanho">
            <span>Tamanho</span>
            <input id="qa-size" type="range" min="1" max="12" value="3" aria-label="Espessura">
          </label>
          <label class="qualiflow-run-annot-field" id="qa-fill-wrap" title="Preencher forma">
            <input id="qa-fill" type="checkbox"> <span>Preencher</span>
          </label>
        </div>
        <div class="qualiflow-run-annot-group">
          <button type="button" id="qa-undo" class="qualiflow-run-annot-action" title="Desfazer (Ctrl+Z)">Desfazer</button>
          <button type="button" id="qa-redo" class="qualiflow-run-annot-action" title="Refazer (Ctrl+Y)">Refazer</button>
          <button type="button" id="qa-delete" class="qualiflow-run-annot-action" title="Excluir seleção (Delete)">Excluir</button>
          <button type="button" id="qa-crop-apply" class="qualiflow-run-annot-action is-primary" title="Aplicar o recorte (Enter)" hidden>Aplicar recorte</button>
          <button type="button" id="qa-crop-reset" class="qualiflow-run-annot-action" title="Voltar à imagem inteira" hidden>Restaurar imagem</button>
        </div>
        <div class="qualiflow-run-annot-group">
          <button type="button" id="qa-zoom-out" class="qualiflow-run-annot-action" title="Reduzir zoom" aria-label="Reduzir zoom">&minus;</button>
          <button type="button" id="qa-zoom-fit" class="qualiflow-run-annot-action qualiflow-run-annot-zoomval" title="Ajustar à janela">100%</button>
          <button type="button" id="qa-zoom-in" class="qualiflow-run-annot-action" title="Aumentar zoom" aria-label="Aumentar zoom">+</button>
        </div>
        <div class="qualiflow-u-grow"></div>
        <label class="qualiflow-run-annot-field" title="Grava CT, data/hora e URL no rodapé da imagem salva">
          <input id="qa-watermark" type="checkbox"> <span>Marca d'água</span>
        </label>
        <button type="button" id="qa-copy" class="qualiflow-run-annot-action" title="Copia a imagem anotada para a área de transferência">Copiar</button>
        <button type="button" id="qa-cancel" class="qualiflow-btn-inline qualiflow-btn-sm qualiflow-run-btn-danger-outline">Cancelar</button>
        <button type="button" id="qa-save" class="qualiflow-btn-inline qualiflow-btn-sm qualiflow-btn-success" title="Ctrl+Enter">Salvar e anexar</button>
      </div>
      <div class="qualiflow-run-annot-stage" id="qa-stage">
        <canvas id="qa-canvas" class="qualiflow-run-annot-canvas" aria-label="Área de anotação da captura de tela"></canvas>
      </div>
      <div class="qualiflow-run-annot-status" id="qa-status" aria-live="polite"></div>
    `;
    document.body.appendChild(panel);

    const $ = (sel) => panel.querySelector(sel);
    const stage = $('#qa-stage');
    const canvas = $('#qa-canvas');
    const ctx = canvas.getContext('2d');
    const statusEl = $('#qa-status');
    const zoomLabel = $('#qa-zoom-fit');

    // ------------------------------------------------------------ estado
    let img = null;
    let unit = 1;              // escala de espessura para imagens grandes
    let displayScale = 1;      // pixels de tela por pixel de imagem
    let zoomMode = 'fit';      // 'fit' | numero
    let tool = 'rect';
    let color = '#ef4444';
    let size = 3;
    let fill = false;
    let objects = [];
    let selectedId = null;
    let draft = null;
    let crop = null;           // regiao visivel da imagem original: { x, y, w, h }
    let cropDraft = null;      // arrasto em andamento
    let pendingCrop = null;    // area escolhida, aguardando Enter
    let editingId = null;
    let interaction = null;    // { kind: 'move'|'resize', ... }
    let idSeq = 0;
    const history = [];
    let historyIndex = -1;
    let closed = false;

    const snapshot = () => JSON.stringify({ o: objects, c: crop });
    const selected = () => objects.find((o) => o.id === selectedId) || null;

    function record() {
        history.length = historyIndex + 1;
        history.push(snapshot());
        if (history.length > UNDO_LIMIT) history.shift();
        historyIndex = history.length - 1;
        updateButtons();
    }
    function restore(index) {
        historyIndex = index;
        const state = JSON.parse(history[index]);
        objects = state.o;
        const cropChanged = !crop || crop.x !== state.c.x || crop.y !== state.c.y || crop.w !== state.c.w || crop.h !== state.c.h;
        crop = state.c;
        pendingCrop = null;
        cropDraft = null;
        if (!objects.some((o) => o.id === selectedId)) selectedId = null;
        syncPropsFromSelection();
        updateButtons();
        if (cropChanged) { applyCropSize(); layout(); } else redraw();
    }
    const undo = () => { if (editingId) return; if (historyIndex > 0) restore(historyIndex - 1); };
    const redo = () => { if (editingId) return; if (historyIndex < history.length - 1) restore(historyIndex + 1); };

    function updateButtons() {
        $('#qa-undo').disabled = historyIndex <= 0;
        $('#qa-redo').disabled = historyIndex >= history.length - 1;
        $('#qa-delete').disabled = !selectedId;
        $('#qa-crop-apply').hidden = !pendingCrop;
        $('#qa-crop-reset').hidden = !(crop && img && (crop.w !== img.naturalWidth || crop.h !== img.naturalHeight));
        const sel = selected();
        const showFill = tool === 'rect' || tool === 'ellipse' || (sel && (sel.type === 'rect' || sel.type === 'ellipse'));
        $('#qa-fill-wrap').style.display = showFill ? '' : 'none';
        panel.querySelectorAll('[data-tool]').forEach((b) => {
            const on = b.dataset.tool === tool;
            b.classList.toggle('is-active', on);
            b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        panel.querySelectorAll('[data-color]').forEach((b) => {
            b.classList.toggle('is-active', b.dataset.color.toLowerCase() === color.toLowerCase());
        });
        const count = objects.length;
        if (tool === 'crop') {
            statusEl.textContent = pendingCrop
                ? `Recorte ${Math.round(pendingCrop.w)} x ${Math.round(pendingCrop.h)} px: Enter aplica, Esc cancela.`
                : 'Arraste sobre a imagem para escolher a área do recorte.';
            return;
        }
        statusEl.textContent = count === 0
            ? 'Escolha uma ferramenta e desenhe sobre a imagem.'
            : `${count} anotaç${count === 1 ? 'ão' : 'ões'}${sel ? ' · 1 selecionada (arraste para mover, Delete para excluir)' : ''}`;
    }

    function syncPropsFromSelection() {
        const sel = selected();
        if (!sel) return;
        color = sel.color;
        $('#qa-color').value = toHex(sel.color);
        size = sel.size;
        $('#qa-size').value = String(sel.size);
        if (sel.type === 'rect' || sel.type === 'ellipse') {
            fill = !!sel.filled;
            $('#qa-fill').checked = fill;
        }
    }

    function toHex(c) { return /^#[0-9a-f]{6}$/i.test(c) ? c : '#ef4444'; }

    // ---------------------------------------------------------- renderizacao
    function fontSizeFor(sizeVal) { return (12 + sizeVal * 3) * unit; }
    function markerRadius(sizeVal) { return (9 + sizeVal * 1.5) * unit; }

    function drawBlur(c, o) {
        const b = normalizeBox(o);
        const x = Math.max(0, Math.round(b.x));
        const y = Math.max(0, Math.round(b.y));
        const w = Math.min(img.naturalWidth - x, Math.round(b.w));
        const h = Math.min(img.naturalHeight - y, Math.round(b.h));
        if (w < 2 || h < 2) return;
        const block = Math.max(6, Math.round(10 * unit));
        const tw = Math.max(1, Math.round(w / block));
        const th = Math.max(1, Math.round(h / block));
        const tmp = document.createElement('canvas');
        tmp.width = tw; tmp.height = th;
        tmp.getContext('2d').drawImage(img, x, y, w, h, 0, 0, tw, th);
        c.save();
        c.imageSmoothingEnabled = false;
        c.drawImage(tmp, 0, 0, tw, th, x, y, w, h);
        c.restore();
    }

    function drawText(c, o) {
        const fs = o.fs || fontSizeFor(o.size);
        const lines = String(o.text || '').split('\n');
        c.save();
        c.font = `600 ${fs}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
        c.textBaseline = 'top';
        const pad = fs * 0.25;
        const widths = lines.map((l) => c.measureText(l).width);
        o.w = Math.max(...widths, fs) + pad * 2;
        o.h = lines.length * fs * 1.25 + pad * 2;
        if (editingId !== o.id) {
            c.lineJoin = 'round';
            c.lineWidth = Math.max(2, fs / 5);
            c.strokeStyle = isLight(o.color) ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.92)';
            c.fillStyle = o.color;
            lines.forEach((l, i) => {
                const ty = o.y + pad + i * fs * 1.25;
                c.strokeText(l, o.x + pad, ty);
                c.fillText(l, o.x + pad, ty);
            });
        }
        c.restore();
    }

    function isLight(hex) {
        const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
        if (!m) return false;
        const lum = 0.299 * parseInt(m[1], 16) + 0.587 * parseInt(m[2], 16) + 0.114 * parseInt(m[3], 16);
        return lum > 160;
    }

    function drawObject(c, o) {
        const lw = o.size * unit;
        c.save();
        c.lineWidth = lw;
        c.strokeStyle = o.color;
        c.fillStyle = o.color;
        c.lineCap = 'round';
        c.lineJoin = 'round';
        switch (o.type) {
            case 'pen':
                c.beginPath();
                o.points.forEach(([x, y], i) => (i === 0 ? c.moveTo(x, y) : c.lineTo(x, y)));
                if (o.points.length === 1) c.lineTo(o.points[0][0] + 0.01, o.points[0][1]);
                c.stroke();
                break;
            case 'line':
            case 'arrow': {
                c.beginPath();
                c.moveTo(o.x1, o.y1);
                c.lineTo(o.x2, o.y2);
                c.stroke();
                if (o.type === 'arrow') {
                    const [tip, a, b] = arrowHead(o.x1, o.y1, o.x2, o.y2, o.size * unit / 1.5);
                    c.beginPath();
                    c.moveTo(tip[0], tip[1]); c.lineTo(a[0], a[1]); c.lineTo(b[0], b[1]);
                    c.closePath();
                    c.fill();
                }
                break;
            }
            case 'rect': {
                const b = normalizeBox(o);
                if (o.filled) { c.globalAlpha = 0.25; c.fillRect(b.x, b.y, b.w, b.h); c.globalAlpha = 1; }
                c.strokeRect(b.x, b.y, b.w, b.h);
                break;
            }
            case 'ellipse': {
                const b = normalizeBox(o);
                c.beginPath();
                c.ellipse(b.x + b.w / 2, b.y + b.h / 2, b.w / 2, b.h / 2, 0, 0, Math.PI * 2);
                if (o.filled) { c.globalAlpha = 0.25; c.fill(); c.globalAlpha = 1; }
                c.stroke();
                break;
            }
            case 'highlight': {
                const b = normalizeBox(o);
                c.globalAlpha = 0.38;
                c.fillRect(b.x, b.y, b.w, b.h);
                break;
            }
            case 'blur':
                drawBlur(c, o);
                break;
            case 'text':
                drawText(c, o);
                break;
            case 'marker': {
                c.beginPath();
                c.arc(o.x, o.y, o.r, 0, Math.PI * 2);
                c.fill();
                c.lineWidth = Math.max(2, unit * 2);
                c.strokeStyle = isLight(o.color) ? '#111827' : '#ffffff';
                c.stroke();
                c.fillStyle = isLight(o.color) ? '#111827' : '#ffffff';
                c.font = `700 ${o.r * 1.15}px system-ui, sans-serif`;
                c.textAlign = 'center';
                c.textBaseline = 'middle';
                c.fillText(String(o.n), o.x, o.y + o.r * 0.06);
                break;
            }
        }
        c.restore();
    }

    function drawSelection(c, o) {
        const b = boundsOf(o);
        const px = 1 / displayScale;
        c.save();
        c.strokeStyle = '#7c5cff';
        c.lineWidth = 1.5 * px;
        c.setLineDash([6 * px, 4 * px]);
        c.strokeRect(b.x - 3 * px, b.y - 3 * px, b.w + 6 * px, b.h + 6 * px);
        c.setLineDash([]);
        c.fillStyle = '#ffffff';
        handlesOf(o).forEach((h) => {
            c.beginPath();
            c.rect(h.x - 4 * px, h.y - 4 * px, 8 * px, 8 * px);
            c.fill();
            c.stroke();
        });
        c.restore();
    }

    function drawCropOverlay(c) {
        const r = pendingCrop || (cropDraft && normRect(cropDraft));
        if (!r) return;
        const x = r.x - crop.x;
        const y = r.y - crop.y;
        const px = 1 / displayScale;
        c.save();
        c.fillStyle = 'rgba(0, 0, 0, 0.55)';
        c.fillRect(0, 0, crop.w, y);
        c.fillRect(0, y + r.h, crop.w, crop.h - y - r.h);
        c.fillRect(0, y, x, r.h);
        c.fillRect(x + r.w, y, crop.w - x - r.w, r.h);
        c.strokeStyle = '#ffffff';
        c.lineWidth = 2 * px;
        c.setLineDash([8 * px, 5 * px]);
        c.strokeRect(x, y, r.w, r.h);
        c.restore();
    }

    function render(c, withUi) {
        c.drawImage(img, crop.x, crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h);
        c.save();
        c.translate(-crop.x, -crop.y);
        objects.forEach((o) => drawObject(c, o));
        if (draft) drawObject(c, draft);
        if (withUi) {
            const sel = selected();
            if (sel && editingId !== sel.id) drawSelection(c, sel);
        }
        c.restore();
        if (withUi && tool === 'crop') drawCropOverlay(c);
    }

    function normRect(d) {
        const x = Math.max(crop.x, Math.min(d.x1, d.x2));
        const y = Math.max(crop.y, Math.min(d.y1, d.y2));
        const x2 = Math.min(crop.x + crop.w, Math.max(d.x1, d.x2));
        const y2 = Math.min(crop.y + crop.h, Math.max(d.y1, d.y2));
        return { x, y, w: x2 - x, h: y2 - y };
    }

    function applyCropSize() {
        canvas.width = crop.w;
        canvas.height = crop.h;
    }

    function applyCrop() {
        if (!pendingCrop) return;
        crop = { x: Math.round(pendingCrop.x), y: Math.round(pendingCrop.y), w: Math.max(1, Math.round(pendingCrop.w)), h: Math.max(1, Math.round(pendingCrop.h)) };
        pendingCrop = null;
        cropDraft = null;
        applyCropSize();
        record();
        layout();
        updateButtons();
    }

    function resetCrop() {
        crop = { x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight };
        pendingCrop = null;
        cropDraft = null;
        applyCropSize();
        record();
        layout();
        updateButtons();
    }

    function redraw() {
        if (!img) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        render(ctx, true);
    }

    // ------------------------------------------------------------------ zoom
    function layout() {
        if (!img) return;
        const w = crop.w;
        const h = crop.h;
        if (zoomMode === 'fit') {
            const availW = Math.max(100, stage.clientWidth - 32);
            const availH = Math.max(100, stage.clientHeight - 32);
            displayScale = Math.min(availW / w, availH / h, 1);
        } else {
            displayScale = zoomMode;
        }
        canvas.style.width = `${Math.round(w * displayScale)}px`;
        canvas.style.height = `${Math.round(h * displayScale)}px`;
        zoomLabel.textContent = `${Math.round(displayScale * 100)}%`;
        positionTextEditor();
        redraw();
    }
    function stepZoom(dir) {
        const cur = displayScale;
        const next = dir > 0
            ? ZOOM_STEPS.find((z) => z > cur + 0.001)
            : [...ZOOM_STEPS].reverse().find((z) => z < cur - 0.001);
        if (next) { zoomMode = next; layout(); }
    }
    const onResize = () => { if (zoomMode === 'fit') layout(); };
    window.addEventListener('resize', onResize);

    // --------------------------------------------------------------- ponteiro
    function pos(e) {
        const r = canvas.getBoundingClientRect();
        return {
            x: crop.x + (e.clientX - r.left) * (canvas.width / r.width),
            y: crop.y + (e.clientY - r.top) * (canvas.height / r.height)
        };
    }
    const tol = () => 8 / displayScale;

    function newId() { idSeq += 1; return idSeq; }

    function startDraft(p) {
        const base = { id: newId(), color, size };
        if (tool === 'pen') draft = { ...base, type: 'pen', points: [[p.x, p.y]] };
        else if (tool === 'line' || tool === 'arrow') draft = { ...base, type: tool, x1: p.x, y1: p.y, x2: p.x, y2: p.y };
        else if (isBox({ type: tool })) draft = { ...base, type: tool, x: p.x, y: p.y, w: 0, h: 0, filled: (tool === 'rect' || tool === 'ellipse') ? fill : undefined };
    }

    function updateDraft(p, e) {
        if (!draft) return;
        if (draft.type === 'pen') {
            const last = draft.points[draft.points.length - 1];
            if (Math.hypot(p.x - last[0], p.y - last[1]) > 1.5 / displayScale) draft.points.push([p.x, p.y]);
        } else if (isLine(draft)) {
            let end = p;
            if (e.shiftKey) end = snapAngle(draft.x1, draft.y1, p.x, p.y);
            draft.x2 = end.x; draft.y2 = end.y;
        } else {
            let w = p.x - draft.x;
            let h = p.y - draft.y;
            if (e.shiftKey && (draft.type === 'rect' || draft.type === 'ellipse')) {
                const m = Math.max(Math.abs(w), Math.abs(h));
                w = Math.sign(w || 1) * m; h = Math.sign(h || 1) * m;
            }
            draft.w = w; draft.h = h;
        }
    }

    function commitDraft() {
        if (!draft) return;
        let obj = isBox(draft) ? normalizeBox(draft) : draft;
        draft = null;
        if (isDegenerate(obj)) { redraw(); return; }
        if (obj.type === 'blur') obj = { ...obj, size: 1 };
        objects.push(obj);
        selectedId = obj.id;
        record();
        updateButtons();
        redraw();
    }

    function placeMarker(p) {
        const obj = { id: newId(), type: 'marker', x: p.x, y: p.y, r: markerRadius(size), n: nextMarkerNumber(objects), color, size };
        objects.push(obj);
        selectedId = obj.id;
        record();
        updateButtons();
        redraw();
    }

    canvas.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        if (editingId) endTextEdit(true);
        const p = pos(e);
        try { canvas.setPointerCapture(e.pointerId); } catch { /* ponteiro sintetico/ja liberado */ }

        if (tool === 'crop') {
            pendingCrop = null;
            selectedId = null;
            cropDraft = { x1: p.x, y1: p.y, x2: p.x, y2: p.y };
            updateButtons();
            redraw();
            return;
        }
        if (tool === 'select') {
            const sel = selected();
            const handle = sel ? pickHandle(sel, p.x, p.y, tol()) : null;
            if (sel && handle) {
                interaction = { kind: 'resize', id: sel.id, handle: handle.id, orig: sel, moved: false };
                return;
            }
            const hit = pickTopmost(objects, p.x, p.y, tol());
            selectedId = hit ? hit.id : null;
            if (hit) {
                syncPropsFromSelection();
                interaction = { kind: 'move', id: hit.id, orig: hit, start: p, moved: false };
            }
            updateButtons();
            redraw();
            return;
        }
        if (tool === 'text') {
            const hit = pickTopmost(objects.filter((o) => o.type === 'text'), p.x, p.y, tol());
            if (hit) { selectedId = hit.id; beginTextEdit(hit); return; }
            const obj = { id: newId(), type: 'text', x: p.x, y: p.y, w: 0, h: 0, text: '', color, size, fs: fontSizeFor(size) };
            beginTextEdit(obj, true);
            return;
        }
        if (tool === 'marker') { placeMarker(p); return; }
        selectedId = null;
        startDraft(p);
        updateButtons();
    });

    canvas.addEventListener('pointermove', (e) => {
        const p = pos(e);
        if (cropDraft) {
            cropDraft.x2 = p.x;
            cropDraft.y2 = p.y;
            redraw();
            return;
        }
        if (interaction) {
            const idx = objects.findIndex((o) => o.id === interaction.id);
            if (idx < 0) return;
            if (interaction.kind === 'move') {
                objects[idx] = translate(interaction.orig, p.x - interaction.start.x, p.y - interaction.start.y);
            } else {
                objects[idx] = resizeByHandle(interaction.orig, interaction.handle, p.x, p.y);
            }
            interaction.moved = true;
            redraw();
            return;
        }
        if (draft) { updateDraft(p, e); redraw(); return; }
        updateCursor(p);
    });

    function finishPointer() {
        if (cropDraft) {
            const r = normRect(cropDraft);
            cropDraft = null;
            pendingCrop = r.w >= 10 && r.h >= 10 ? r : null;
            updateButtons();
            redraw();
            return;
        }
        if (interaction) {
            const moved = interaction.moved;
            interaction = null;
            if (moved) record();
            redraw();
            return;
        }
        commitDraft();
    }
    canvas.addEventListener('pointerup', finishPointer);
    canvas.addEventListener('pointercancel', finishPointer);

    canvas.addEventListener('dblclick', (e) => {
        const p = pos(e);
        const hit = pickTopmost(objects.filter((o) => o.type === 'text'), p.x, p.y, tol());
        if (hit) { selectedId = hit.id; beginTextEdit(hit); }
    });

    function updateCursor(p) {
        if (tool !== 'select') { canvas.style.cursor = tool === 'text' ? 'text' : 'crosshair'; return; }
        const sel = selected();
        if (sel && pickHandle(sel, p.x, p.y, tol())) { canvas.style.cursor = 'nwse-resize'; return; }
        canvas.style.cursor = pickTopmost(objects, p.x, p.y, tol()) ? 'move' : 'default';
    }

    stage.addEventListener('wheel', (e) => {
        if (!e.ctrlKey) return;
        e.preventDefault();
        stepZoom(e.deltaY < 0 ? 1 : -1);
    }, { passive: false });

    // ---------------------------------------------------------- edicao de texto
    let textEditor = null;
    let editingIsNew = false;

    function beginTextEdit(obj, isNew = false) {
        editingId = obj.id;
        editingIsNew = isNew;
        if (isNew) objects.push(obj);
        selectedId = obj.id;
        textEditor = document.createElement('textarea');
        textEditor.className = 'qualiflow-run-annot-textedit';
        textEditor.value = obj.text || '';
        textEditor.setAttribute('aria-label', 'Texto da anotação');
        textEditor.rows = 1;
        stage.appendChild(textEditor);
        positionTextEditor();
        redraw();
        textEditor.focus();
        textEditor.select();
        textEditor.addEventListener('input', () => {
            const o = objects.find((x) => x.id === editingId);
            if (o) { o.text = textEditor.value; }
            positionTextEditor();
        });
        textEditor.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'Escape') { e.preventDefault(); endTextEdit(false); }
            else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); endTextEdit(true); }
        });
        textEditor.addEventListener('blur', () => endTextEdit(true));
    }

    function positionTextEditor() {
        if (!textEditor || !editingId) return;
        const o = objects.find((x) => x.id === editingId);
        if (!o) return;
        const cr = canvas.getBoundingClientRect();
        const sr = stage.getBoundingClientRect();
        const fs = (o.fs || fontSizeFor(o.size)) * displayScale;
        const pad = (o.fs || fontSizeFor(o.size)) * 0.25 * displayScale;
        textEditor.style.left = `${cr.left - sr.left + stage.scrollLeft + (o.x - crop.x) * displayScale}px`;
        textEditor.style.top = `${cr.top - sr.top + stage.scrollTop + (o.y - crop.y) * displayScale}px`;
        textEditor.style.fontSize = `${fs}px`;
        textEditor.style.padding = `${pad}px`;
        textEditor.style.color = o.color;
        const lines = textEditor.value.split('\n');
        textEditor.style.height = `${lines.length * fs * 1.25 + pad * 2 + 4}px`;
        textEditor.style.width = `${Math.max(120, Math.max(...lines.map((l) => l.length)) * fs * 0.62 + pad * 2 + 20)}px`;
    }

    function endTextEdit(commit) {
        if (!textEditor) return;
        const ed = textEditor;
        textEditor = null;
        const id = editingId;
        editingId = null;
        const o = objects.find((x) => x.id === id);
        ed.remove();
        if (!o) return;
        const text = ed.value;
        if (!commit || !text.trim()) {
            if (editingIsNew || !text.trim()) objects = objects.filter((x) => x.id !== id);
            if (selectedId === id && !objects.some((x) => x.id === id)) selectedId = null;
        } else {
            o.text = text;
            record();
        }
        updateButtons();
        redraw();
    }

    // ------------------------------------------------------------- controles
    function setTool(id) {
        if (editingId) endTextEdit(true);
        if (tool === 'crop' && id !== 'crop') { pendingCrop = null; cropDraft = null; }
        tool = id;
        if (id !== 'select') selectedId = null;
        updateButtons();
        redraw();
        canvas.style.cursor = id === 'select' ? 'default' : id === 'text' ? 'text' : 'crosshair';
    }
    panel.querySelectorAll('[data-tool]').forEach((b) => { b.onclick = () => setTool(b.dataset.tool); });
    $('#qa-crop-apply').onclick = applyCrop;
    $('#qa-crop-reset').onclick = resetCrop;

    function applyToSelection(mutator) {
        const sel = selected();
        if (!sel) return false;
        const idx = objects.findIndex((o) => o.id === sel.id);
        objects[idx] = mutator({ ...sel });
        return true;
    }

    function setColor(c, commit) {
        color = c;
        $('#qa-color').value = toHex(c);
        const changed = applyToSelection((o) => ({ ...o, color: c }));
        if (changed && commit) record();
        updateButtons();
        redraw();
    }
    panel.querySelectorAll('[data-color]').forEach((b) => { b.onclick = () => setColor(b.dataset.color, true); });
    $('#qa-color').addEventListener('input', (e) => setColor(e.target.value, false));
    $('#qa-color').addEventListener('change', (e) => setColor(e.target.value, true));

    $('#qa-size').addEventListener('input', (e) => {
        size = parseInt(e.target.value, 10);
        applyToSelection((o) => {
            const next = { ...o, size };
            if (o.type === 'text') next.fs = fontSizeFor(size);
            if (o.type === 'marker') next.r = markerRadius(size);
            return next;
        });
        redraw();
    });
    $('#qa-size').addEventListener('change', () => { if (selected()) record(); });

    $('#qa-fill').addEventListener('change', (e) => {
        fill = e.target.checked;
        if (applyToSelection((o) => ({ ...o, filled: fill }))) record();
        redraw();
    });

    function deleteSelected() {
        if (!selectedId || editingId) return;
        objects = objects.filter((o) => o.id !== selectedId);
        selectedId = null;
        record();
        updateButtons();
        redraw();
    }

    $('#qa-undo').onclick = undo;
    $('#qa-redo').onclick = redo;
    $('#qa-delete').onclick = deleteSelected;
    $('#qa-zoom-in').onclick = () => stepZoom(1);
    $('#qa-zoom-out').onclick = () => stepZoom(-1);
    zoomLabel.onclick = () => { zoomMode = 'fit'; layout(); };

    // ------------------------------------------------------------ fechamento
    function close(result) {
        if (closed) return;
        closed = true;
        document.removeEventListener('keydown', onKeydown, true);
        window.removeEventListener('resize', onResize);
        panel.remove();
        onSave(result);
        if (!result && opener && opener.isConnected && typeof opener.focus === 'function') opener.focus();
    }

    const wmBox = $('#qa-watermark');
    wmBox.checked = watermarkPref && !!options.watermarkText;
    wmBox.disabled = !options.watermarkText;
    wmBox.addEventListener('change', () => { watermarkPref = wmBox.checked; });

    function drawWatermark(c, text) {
        const fs = Math.max(12, Math.round(13 * unit));
        const padX = Math.round(fs * 0.7);
        const barH = Math.round(fs * 2);
        c.save();
        c.font = `500 ${fs}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
        c.textBaseline = 'middle';
        let t = text;
        const max = c.canvas.width - padX * 2;
        while (t.length > 4 && c.measureText(t).width > max) t = `${t.slice(0, -4)}...`;
        c.fillStyle = 'rgba(0, 0, 0, 0.7)';
        c.fillRect(0, c.canvas.height - barH, c.canvas.width, barH);
        c.fillStyle = '#ffffff';
        c.fillText(t, padX, c.canvas.height - barH / 2);
        c.restore();
    }

    /** Imagem final (sem alcas/recorte pendente), com marca d'agua se marcada. */
    function exportCanvas() {
        if (editingId) endTextEdit(true);
        const out = document.createElement('canvas');
        out.width = crop.w;
        out.height = crop.h;
        const octx = out.getContext('2d');
        selectedId = null;
        pendingCrop = null;
        const prevDraft = draft; draft = null;
        const prevTool = tool; tool = 'select';
        render(octx, false);
        tool = prevTool;
        draft = prevDraft;
        if (wmBox.checked && options.watermarkText) drawWatermark(octx, options.watermarkText);
        return out;
    }

    function save() {
        close(exportCanvas().toDataURL('image/png'));
    }

    async function copyImage() {
        const out = exportCanvas();
        redraw();
        try {
            const blob = await new Promise((resolve, reject) => out.toBlob((b) => (b ? resolve(b) : reject(new Error('sem imagem'))), 'image/png'));
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            statusEl.textContent = 'Imagem copiada para a área de transferência.';
        } catch {
            statusEl.textContent = 'Não foi possível copiar (permissão do navegador). Use "Salvar e anexar".';
        }
    }
    $('#qa-copy').onclick = copyImage;

    function cancel() {
        if (objects.length > 0 && !confirm('Descartar a captura e as anotações feitas?')) return;
        close(null);
    }

    $('#qa-cancel').onclick = cancel;
    $('#qa-save').onclick = save;

    function onKeydown(e) {
        const typing = e.target instanceof HTMLElement && (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT' && e.target.type !== 'range' && e.target.type !== 'checkbox');
        const mod = e.ctrlKey || e.metaKey;
        if (e.key === 'Escape') {
            e.preventDefault();
            if (typing) return;
            if (pendingCrop || cropDraft) { pendingCrop = null; cropDraft = null; updateButtons(); redraw(); return; }
            cancel();
            return;
        }
        if (e.key === 'Enter' && !typing && pendingCrop) { e.preventDefault(); applyCrop(); return; }
        if (typing) return;
        if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
        if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
        if (mod && e.key === 'Enter') { e.preventDefault(); save(); return; }
        if (mod && (e.key === '+' || e.key === '=')) { e.preventDefault(); stepZoom(1); return; }
        if (mod && e.key === '-') { e.preventDefault(); stepZoom(-1); return; }
        if (mod && e.key === '0') { e.preventDefault(); zoomMode = 'fit'; layout(); return; }
        if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelected(); return; }
        if (mod || e.altKey) return;
        const t = TOOLS.find((x) => x.key === e.key.toLowerCase());
        if (t) { e.preventDefault(); setTool(t.id); }
    }
    document.addEventListener('keydown', onKeydown, true);

    // -------------------------------------------------------------- imagem
    const image = new Image();
    image.onload = () => {
        img = image;
        crop = { x: 0, y: 0, w: image.naturalWidth, h: image.naturalHeight };
        applyCropSize();
        unit = Math.max(1, image.naturalWidth / 1280);
        record();
        layout();
        updateButtons();
    };
    image.onerror = () => {
        statusEl.textContent = 'Não foi possível carregar a imagem capturada.';
    };
    image.src = srcDataUrl;

    updateButtons();
    panel.querySelector('[data-tool="rect"]').focus();
}
