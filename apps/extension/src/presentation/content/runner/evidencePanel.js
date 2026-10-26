import { sendRuntimeMessage } from '../shared/runtime.js';
import { S } from './state.js';
import { openAnnotationPanel } from './annotationPanel.js';
import { addAndUploadEvidence, buildEvidenceFileName, getEvidenceKey, uploadEvidenceToAzure } from './evidenceUpload.js';
import { hideQualiFlowUiForCapture, removeRecordingFloatingBar, showQualiFlowUiAfterCapture, showRecordingFloatingBar, waitForUiHidden } from './screenCapture.js';
import { RuntimeActions } from '../../../contracts/runtimeActions.js';

export function openEvidencePanel(tc, stepIdx) {
    const key = getEvidenceKey(tc, stepIdx);
    if (!S.runnerState.evidences[key]) S.runnerState.evidences[key] = [];
    const list = S.runnerState.evidences[key];
    const label = stepIdx !== null && stepIdx !== undefined
        ? `Passo ${tc.steps[stepIdx]?.order ?? (stepIdx + 1)}`
        : `CT #${tc.id}`;

    // Build overlay
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
          <span id="qe-title" class="qualiflow-dialog-title">📎 Evidências — ${label}</span>
          <button type="button" id="qe-close" class="qualiflow-close" aria-label="Fechar evidências">✕</button>
        </div>

        <div class="qualiflow-run-note">
          Anexos da execução no Azure (Test Run). Não são salvos localmente.
        </div>

        <div class="qualiflow-run-ev-actions">
          <button type="button" id="qe-screenshot" class="qualiflow-btn-inline qualiflow-btn-primary">📸 Capturar Tela</button>
          <button type="button" id="qe-record" class="qualiflow-btn-inline qualiflow-btn-secondary" data-recording="false">🔴 Gravar Tela</button>
        </div>

        <div id="qe-rec-status" class="qualiflow-run-rec-status" style="display:none;"></div>

        <div id="qe-list" class="qualiflow-run-ev-list" aria-live="polite"></div>
      </div>
    `;

    document.body.appendChild(overlay);
    renderEvidenceList(list, key);

    const isRecording = () => !!(S.mediaRecorder && S.mediaRecorder.state === 'recording');
    const onKeydown = (e) => {
        if (e.key !== 'Escape') return;
        if (document.getElementById('qualiflow-annotation-panel')) return; // annotation handles its own Esc
        if (isRecording()) return;
        closePanel();
    };
    function closePanel() {
        document.removeEventListener('keydown', onKeydown);
        overlay.remove();
        if (opener && opener.isConnected && typeof opener.focus === 'function') opener.focus();
    }
    document.addEventListener('keydown', onKeydown);

    overlay.querySelector('#qe-close').onclick = () => {
        if (isRecording()) return; // keep open while recording
        closePanel();
    };
    overlay.onclick = (e) => {
        if (e.target === overlay && !isRecording()) closePanel();
    };
    overlay.querySelector('#qe-close').focus();

    overlay.querySelector('#qe-screenshot').onclick = async () => {
        const btn = overlay.querySelector('#qe-screenshot');
        btn.disabled = true;
        btn.textContent = '⏳ Capturando...';

        // Hide evidence panel + runner so they do not appear in the screenshot
        hideQualiFlowUiForCapture();
        await waitForUiHidden();

        sendRuntimeMessage({ action: RuntimeActions.CAPTURE_SCREENSHOT }, (res) => {
            btn.disabled = false;
            btn.innerHTML = '📸 Capturar Tela';

            if (res?.error) {
                showQualiFlowUiAfterCapture();
                alert('Erro: ' + res.error);
                return;
            }

            // Keep UI hidden while annotation opens (fullscreen). Restore after save/cancel.
            openAnnotationPanel(res.dataUrl, async (annotated) => {
                showQualiFlowUiAfterCapture();
                if (!annotated) return;
                const name = buildEvidenceFileName(tc, stepIdx, 'screenshot', 'png');
                await addAndUploadEvidence(tc, stepIdx, list, key, {
                    name,
                    dataUrl: annotated,
                    type: 'image/png',
                    status: 'pending'
                });
            });
        });
    };

    const recBtn = overlay.querySelector('#qe-record');
    const recStatus = overlay.querySelector('#qe-rec-status');

    const resetRecordUi = () => {
        recBtn.innerHTML = '🔴 Gravar Tela';
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
            // Browser picker first (UI still visible for the picker itself)
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });

            // Then hide runner chrome so the recording does not show our panels
            hideQualiFlowUiForCapture(['qualiflow-rec-floating']);
            await waitForUiHidden();

            S.recordingChunks = [];
            S.mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
            S.mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) S.recordingChunks.push(e.data); };
            S.mediaRecorder.onstop = async () => {
                stream.getTracks().forEach(t => t.stop());
                const blob = new Blob(S.recordingChunks, { type: 'video/webm' });
                const url = URL.createObjectURL(blob);
                const name = buildEvidenceFileName(tc, stepIdx, 'recording', 'webm');
                await addAndUploadEvidence(tc, stepIdx, list, key, {
                    name,
                    dataUrl: url,
                    type: 'video/webm',
                    blob,
                    status: 'pending'
                });
            };

            // If user stops sharing via browser chrome
            stream.getVideoTracks()[0]?.addEventListener('ended', () => {
                if (S.mediaRecorder && S.mediaRecorder.state === 'recording') {
                    S.mediaRecorder.stop();
                }
                resetRecordUi();
            });

            S.mediaRecorder.start(100);
            S.recordingSeconds = 0;
            recBtn.innerHTML = '⏹ Parar Gravação';
            recBtn.classList.remove('qualiflow-btn-secondary');
            recBtn.classList.add('qualiflow-btn-danger');

            const floating = showRecordingFloatingBar(stopRecording);
            const timerEl = floating.querySelector('#qualiflow-rec-floating-timer');
            S.recordingTimer = setInterval(() => {
                S.recordingSeconds++;
                if (timerEl) timerEl.textContent = `⏺ ${S.recordingSeconds}s`;
                recStatus.style.display = 'block';
                recStatus.textContent = `⏺ Gravando... ${S.recordingSeconds}s`;
            }, 1000);
        } catch (e) {
            showQualiFlowUiAfterCapture();
            alert('Não foi possível iniciar a gravação: ' + e.message);
        }
    };
}

function evidenceStatusHtml(ev) {
    if (ev.status === 'uploading' || ev.status === 'pending') {
        return '<span class="qualiflow-run-ev-state is-pending">⏳ Enviando ao Azure...</span>';
    }
    if (ev.status === 'uploaded') {
        return '<span class="qualiflow-run-ev-state is-uploaded">✅ Anexado à execução</span>';
    }
    if (ev.status === 'error') {
        return `<span class="qualiflow-run-ev-state is-error" title="${(ev.error || '').replace(/"/g, '&quot;')}">❌ Falha no envio</span>`;
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
          ${ev.type === 'video/webm'
            ? `<video src="${ev.dataUrl}" controls class="qualiflow-run-ev-media"></video>`
            : `<img src="${ev.dataUrl}" alt="Evidência ${i + 1}" class="qualiflow-run-ev-media" />`
        }
          <div class="qualiflow-run-ev-item-foot">
            <div class="qualiflow-run-ev-item-info">
              <div class="qualiflow-run-ev-name">${ev.name}</div>
              <div class="qualiflow-u-mt-1">${evidenceStatusHtml(ev)}</div>
            </div>
            <div class="qualiflow-run-ev-item-btns">
              ${ev.status === 'error' ? `<button type="button" class="qe-retry-btn qualiflow-btn-inline qualiflow-btn-sm qualiflow-run-btn-warn-outline" data-idx="${i}">Reenviar</button>` : ''}
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
