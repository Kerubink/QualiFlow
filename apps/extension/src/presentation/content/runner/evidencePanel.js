import { S } from './state.js';
import { annotateAndAttachEvidence } from './evidenceFlow.js';
import { UPLOAD_MAX_ATTEMPTS, addAndUploadEvidence, buildEvidenceFileName, getEvidenceKey, uploadEvidenceToAzure } from './evidenceUpload.js';
import { hideQualiFlowUiForCapture, removeRecordingFloatingBar, showQualiFlowUiAfterCapture, showRecordingFloatingBar, waitForUiHidden } from './screenCapture.js';
import { captureBrowserTab, captureDisplay, imageFromPasteEvent, pickImageFile, readClipboardImage } from './captureSources.js';
import { formatDuration } from '../../../domain/runTimer.js';

export function openEvidencePanel(tc, stepIdx) {
    const key = getEvidenceKey(tc, stepIdx);
    if (!S.runnerState.evidences[key]) S.runnerState.evidences[key] = [];
    const list = S.runnerState.evidences[key];
    const label = stepIdx !== null && stepIdx !== undefined
        ? `Passo ${tc.steps[stepIdx]?.order ?? (stepIdx + 1)}`
        : `CT #${tc.id}`;

    const opener = document.activeElement;
    const overlay = document.createElement('div');
    overlay.id = 'qualiflow-evidence-overlay';
    overlay.className = 'qualiflow-root qualiflow-dialog-overlay qualiflow-run-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'qe-title');
    overlay.innerHTML = `
      <div class="qualiflow-dialog qualiflow-dialog-sm qualiflow-dialog-surface">
        <div class="qualiflow-dialog-head">
          <span id="qe-title" class="qualiflow-dialog-title">Evidências &middot; ${label}</span>
          <button type="button" id="qe-close" class="qualiflow-close" aria-label="Fechar evidências">&times;</button>
        </div>

        <div class="qualiflow-run-note">
          Os anexos são enviados à execução no Azure (Test Run) e não são salvos localmente.
        </div>

        <div class="qualiflow-run-ev-group">
          <div class="qualiflow-run-ev-group-title">Capturar</div>
          <div class="qualiflow-run-ev-actions">
            <button type="button" id="qe-screen" class="qualiflow-btn-inline qualiflow-btn-primary" title="Escolha uma tela inteira, a janela de outro aplicativo ou uma aba">Tela ou janela</button>
            <button type="button" id="qe-screenshot" class="qualiflow-btn-inline qualiflow-btn-secondary" title="Captura somente o conteúdo visível desta aba">Aba atual</button>
          </div>
        </div>

        <div class="qualiflow-run-ev-group">
          <div class="qualiflow-run-ev-group-title">Importar</div>
          <div class="qualiflow-run-ev-actions">
            <button type="button" id="qe-paste" class="qualiflow-btn-inline qualiflow-btn-secondary" title="Cola a imagem da área de transferência (ou use Ctrl+V)">Colar imagem</button>
            <button type="button" id="qe-file" class="qualiflow-btn-inline qualiflow-btn-secondary">Anexar arquivo</button>
          </div>
        </div>

        <div class="qualiflow-run-ev-group">
          <div class="qualiflow-run-ev-group-title">Gravar</div>
          <div class="qualiflow-run-ev-actions">
            <button type="button" id="qe-record" class="qualiflow-btn-inline qualiflow-btn-secondary" data-recording="false">Gravar tela</button>
          </div>
        </div>

        <div id="qe-msg" class="qualiflow-run-ev-msg" role="status" aria-live="polite"></div>
        <div id="qe-rec-status" class="qualiflow-run-rec-status" style="display:none;"></div>
        <div id="qe-list" class="qualiflow-run-ev-list" aria-live="polite"></div>
      </div>
    `;

    document.body.appendChild(overlay);
    renderEvidenceList(list, key);

    const msgEl = overlay.querySelector('#qe-msg');
    const showMsg = (text, isError = false) => {
        msgEl.textContent = text || '';
        msgEl.classList.toggle('is-error', !!isError);
    };
    const isRecording = () => !!(S.mediaRecorder && S.mediaRecorder.state === 'recording');
    const annotationOpen = () => !!document.getElementById('qualiflow-annotation-panel');

    const onKeydown = (e) => {
        if (e.key !== 'Escape') return;
        if (annotationOpen() || isRecording()) return;
        closePanel();
    };
    const onPaste = async (e) => {
        if (annotationOpen() || isRecording()) return;
        const dataUrl = await imageFromPasteEvent(e);
        if (!dataUrl) return;
        e.preventDefault();
        annotateAndAttach(dataUrl, 'print');
    };
    function closePanel() {
        document.removeEventListener('keydown', onKeydown);
        document.removeEventListener('paste', onPaste);
        overlay.remove();
        if (opener && opener.isConnected && typeof opener.focus === 'function') opener.focus();
    }
    document.addEventListener('keydown', onKeydown);
    document.addEventListener('paste', onPaste);

    overlay.querySelector('#qe-close').onclick = () => {
        if (isRecording()) return;
        closePanel();
    };
    overlay.onclick = (e) => {
        if (e.target === overlay && !isRecording()) closePanel();
    };
    overlay.querySelector('#qe-screen').focus();

    function annotateAndAttach(dataUrl, kind) {
        showMsg('');
        annotateAndAttachEvidence(tc, stepIdx, dataUrl, kind);
    }

    // Executa uma captura bloqueando os botoes enquanto ela acontece.
    async function runCapture(button, busyLabel, producer, kind) {
        const idleLabel = button.textContent;
        const buttons = overlay.querySelectorAll('.qualiflow-run-ev-actions button');
        buttons.forEach((b) => { b.disabled = true; });
        button.textContent = busyLabel;
        showMsg('');
        try {
            const dataUrl = await producer();
            if (dataUrl) annotateAndAttach(dataUrl, kind);
        } catch (err) {
            showQualiFlowUiAfterCapture();
            if (!err?.cancelled) showMsg(err?.message || 'Falha na captura.', true);
        } finally {
            button.textContent = idleLabel;
            buttons.forEach((b) => { b.disabled = false; });
        }
    }

    overlay.querySelector('#qe-screen').onclick = (e) =>
        runCapture(e.currentTarget, 'Aguardando seleção...', captureDisplay, 'captura');
    overlay.querySelector('#qe-screenshot').onclick = (e) =>
        runCapture(e.currentTarget, 'Capturando...', captureBrowserTab, 'aba');
    overlay.querySelector('#qe-paste').onclick = (e) =>
        runCapture(e.currentTarget, 'Lendo...', readClipboardImage, 'print');
    overlay.querySelector('#qe-file').onclick = (e) =>
        runCapture(e.currentTarget, 'Selecionando...', pickImageFile, 'arquivo');

    const recBtn = overlay.querySelector('#qe-record');
    const recStatus = overlay.querySelector('#qe-rec-status');

    const resetRecordUi = () => {
        recBtn.textContent = 'Gravar tela';
        recBtn.classList.remove('qualiflow-btn-danger');
        recBtn.classList.add('qualiflow-btn-secondary');
        recStatus.style.display = 'none';
        clearInterval(S.recordingTimer);
        removeRecordingFloatingBar();
        showQualiFlowUiAfterCapture();
    };

    const stopRecording = () => {
        if (S.mediaRecorder && S.mediaRecorder.state === 'recording') {
            S.mediaRecorder.stop();
        }
        resetRecordUi();
    };

    recBtn.onclick = async () => {
        if (S.mediaRecorder && S.mediaRecorder.state === 'recording') {
            stopRecording();
            return;
        }

        try {
            // Seletor do navegador primeiro (UI ainda visivel para o proprio seletor)
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });

            hideQualiFlowUiForCapture(['qualiflow-rec-floating']);
            await waitForUiHidden();

            S.recordingChunks = [];
            S.mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
            S.mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) S.recordingChunks.push(e.data); };
            S.mediaRecorder.onstop = async () => {
                stream.getTracks().forEach(t => t.stop());
                const blob = new Blob(S.recordingChunks, { type: 'video/webm' });
                const url = URL.createObjectURL(blob);
                const name = buildEvidenceFileName(tc, stepIdx, 'gravacao', 'webm');
                await addAndUploadEvidence(tc, stepIdx, list, key, {
                    name,
                    dataUrl: url,
                    type: 'video/webm',
                    blob,
                    status: 'pending'
                });
            };

            // Se o usuario parar o compartilhamento pela barra do navegador
            stream.getVideoTracks()[0]?.addEventListener('ended', () => {
                if (S.mediaRecorder && S.mediaRecorder.state === 'recording') {
                    S.mediaRecorder.stop();
                }
                resetRecordUi();
            });

            S.mediaRecorder.start(100);
            S.recordingSeconds = 0;
            recBtn.textContent = 'Parar gravação';
            recBtn.classList.remove('qualiflow-btn-secondary');
            recBtn.classList.add('qualiflow-btn-danger');

            const floating = showRecordingFloatingBar(stopRecording);
            const timerEl = floating.querySelector('#qualiflow-rec-floating-timer');
            S.recordingTimer = setInterval(() => {
                S.recordingSeconds++;
                const t = formatDuration(S.recordingSeconds * 1000);
                if (timerEl) timerEl.textContent = `REC ${t}`;
                recStatus.style.display = 'block';
                recStatus.textContent = `Gravando... ${t}`;
            }, 1000);
        } catch (e) {
            showQualiFlowUiAfterCapture();
            if (e && e.name !== 'NotAllowedError') showMsg('Não foi possível iniciar a gravação: ' + e.message, true);
        }
    };
}

function evidenceStatusHtml(ev) {
    if (ev.status === 'uploading' || ev.status === 'pending') {
        const tries = ev.attempt > 1 ? ` (tentativa ${ev.attempt} de ${UPLOAD_MAX_ATTEMPTS})` : '';
        return `<span class="qualiflow-run-ev-state is-pending">Enviando ao Azure${tries}...</span>`;
    }
    if (ev.status === 'uploaded') {
        return '<span class="qualiflow-run-ev-state is-uploaded">Anexado à execução</span>';
    }
    if (ev.status === 'error') {
        return `<span class="qualiflow-run-ev-state is-error" title="${(ev.error || '').replace(/"/g, '&quot;')}">Falha no envio</span>`;
    }
    return '<span class="qualiflow-run-ev-state is-none">—</span>';
}

export function renderEvidenceList(list, key) {
    const container = document.getElementById('qe-list');
    if (!container) return;
    if (list.length === 0) {
        container.innerHTML = '<div class="qualiflow-empty">Nenhuma evidência capturada ainda.</div>';
        return;
    }
    container.innerHTML = list.map((ev, i) => `
        <div class="qualiflow-run-ev-item">
          ${!ev.dataUrl
            ? '<div class="qualiflow-run-ev-nopreview">Pré-visualização indisponível</div>'
            : ev.type === 'video/webm'
                ? `<video src="${ev.dataUrl}" controls class="qualiflow-run-ev-media"></video>`
                : `<img src="${ev.dataUrl}" alt="Evidência ${i + 1}" class="qualiflow-run-ev-media" />`
        }
          <div class="qualiflow-run-ev-item-foot">
            <div class="qualiflow-run-ev-item-info">
              <div class="qualiflow-run-ev-name">${ev.name}</div>
              <div class="qualiflow-u-mt-1">${evidenceStatusHtml(ev)}</div>
            </div>
            <div class="qualiflow-run-ev-item-btns">
              ${ev.status === 'error' && (ev.dataUrl || ev.blob) ? `<button type="button" class="qe-retry-btn qualiflow-btn-inline qualiflow-btn-sm qualiflow-run-btn-warn-outline" data-idx="${i}">Reenviar</button>` : ''}
              <button type="button" class="qe-del-btn qualiflow-btn-inline qualiflow-btn-sm qualiflow-run-btn-danger-outline" data-idx="${i}">Remover</button>
            </div>
          </div>
        </div>
    `).join('');

    container.querySelectorAll('.qe-del-btn').forEach(b => {
        b.onclick = () => {
            const idx = parseInt(b.getAttribute('data-idx'));
            list.splice(idx, 1);
            renderEvidenceList(list, key);
        };
    });

    container.querySelectorAll('.qe-retry-btn').forEach(b => {
        b.onclick = async () => {
            const idx = parseInt(b.getAttribute('data-idx'));
            const ev = list[idx];
            if (!ev) return;
            // Recover tc/step from key: "123" or "123_step_0"
            const m = String(key).match(/^(\d+)(?:_step_(\d+))?$/);
            if (!m || !S.runnerState) return;
            const tc = S.runnerState.testCases.find(t => Number(t.id) === Number(m[1]));
            if (!tc) return;
            const stepIdx = m[2] !== undefined ? Number(m[2]) : null;
            ev.status = 'uploading';
            ev.error = undefined;
            renderEvidenceList(list, key);
            const up = await uploadEvidenceToAzure(tc, stepIdx, ev);
            if (up?.error) {
                ev.status = 'error';
                ev.error = up.error;
            } else {
                ev.status = 'uploaded';
                ev.azureId = up.result?.id;
                if (ev.blob) delete ev.blob;
            }
            renderEvidenceList(list, key);
        };
    });
}
