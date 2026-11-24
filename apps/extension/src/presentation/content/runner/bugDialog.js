/* Dialogo "Criar bug": titulo, severidade, resultado obtido e o que anexar (ambiente, console/rede, evidencias). */
import { sendRuntimeMessage, getStorage, setStorage } from '../shared/runtime.js';
import { RuntimeActions } from '../../../contracts/runtimeActions.js';
import { escapeHtml } from '../dashboard/helpers.js';
import { S } from './state.js';
import { getEvidenceListFor } from './evidenceIndicators.js';
import { environmentInfo } from './envInfo.js';
import { probeSince } from './probeClient.js';
import { recordBug } from './runLog.js';
import { showToast } from './toast.js';
import { buildEnvironmentText } from '../../../domain/runInsights.js';
import { formatProbeEvents } from '../../../domain/probeEvents.js';
import { SEVERITIES, buildBugReproHtml, buildBugTitle, normalizeSeverity } from '../../../domain/bugReport.js';
import { formatBytes } from '../../../domain/uiChecks.js';

const MAX_IMAGES = 8;
const DIALOG_ID = 'qualiflow-bug-dialog';

function imageEvidences(tc, stepIdx) {
    return getEvidenceListFor(tc.id, stepIdx)
        .filter((e) => String(e.type || '').startsWith('image/') && typeof e.dataUrl === 'string' && e.dataUrl.startsWith('data:'))
        .slice(0, MAX_IMAGES);
}

export function openBugDialog({ tc, stepIdx }) {
    if (document.getElementById(DIALOG_ID)) return;
    const st = S.runnerState;
    const step = tc.steps[stepIdx];
    const res = st.stepResults[tc.id][stepIdx];
    const images = imageEvidences(tc, stepIdx);
    const imagesBytes = images.reduce((sum, e) => sum + Math.round(e.dataUrl.length * 0.75), 0);
    const probeEvents = probeSince(res.windowStart || 0);

    const overlay = document.createElement('div');
    overlay.id = DIALOG_ID;
    overlay.className = 'qualiflow-root qualiflow-dialog-overlay qualiflow-run-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'qf-bug-title');
    overlay.innerHTML = `
      <div class="qualiflow-dialog qualiflow-dialog-sm qualiflow-dialog-surface">
        <div class="qualiflow-dialog-head">
          <span id="qf-bug-title" class="qualiflow-dialog-title">Criar bug &middot; CT #${escapeHtml(tc.id)}, passo ${escapeHtml(step.order)}</span>
          <button type="button" id="qf-bug-close" class="qualiflow-close" aria-label="Fechar">&times;</button>
        </div>
        <div class="qualiflow-run-bug-form">
          <label class="qualiflow-run-bug-field"><span>Título</span>
            <input id="qf-bug-name" class="qualiflow-input-edit" type="text" value="${escapeHtml(buildBugTitle(tc, step))}"></label>
          <label class="qualiflow-run-bug-field"><span>Severidade</span>
            <select id="qf-bug-sev" class="qualiflow-select-input">${SEVERITIES.map((s) => `<option value="${s.key}">${s.label}</option>`).join('')}</select></label>
          <label class="qualiflow-run-bug-field"><span>Resultado obtido (o que aconteceu)</span>
            <textarea id="qf-bug-got" class="qualiflow-textarea-edit" rows="3" placeholder="Descreva o que aconteceu">${escapeHtml(res.comment || '')}</textarea></label>
          <fieldset class="qualiflow-run-bug-include">
            <legend>Incluir no bug</legend>
            <label><input type="checkbox" id="qf-bug-env" checked> Ambiente (URL, navegador, sistema, janela)</label>
            <label><input type="checkbox" id="qf-bug-probe" ${probeEvents.length ? 'checked' : 'disabled'}> Erros de console e rede durante o passo (${probeEvents.length})</label>
            <label><input type="checkbox" id="qf-bug-img" ${images.length ? 'checked' : 'disabled'}> Anexar imagens do passo (${images.length}${images.length ? `, ${formatBytes(imagesBytes)}` : ''})</label>
          </fieldset>
          <div id="qf-bug-msg" class="qualiflow-run-ev-msg" role="status" aria-live="polite"></div>
          <div class="qualiflow-run-bug-actions">
            <button type="button" id="qf-bug-cancel" class="qualiflow-btn-inline qualiflow-btn-sm qualiflow-run-tool-btn">Cancelar</button>
            <button type="button" id="qf-bug-submit" class="qualiflow-btn-inline qualiflow-btn-danger">Criar bug</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const $ = (sel) => overlay.querySelector(sel);
    let busy = false;
    const close = () => { document.removeEventListener('keydown', onKey, true); overlay.remove(); };
    const onKey = (e) => { if (e.key === 'Escape' && !busy) { e.stopPropagation(); close(); } };
    document.addEventListener('keydown', onKey, true);
    $('#qf-bug-close').onclick = () => { if (!busy) close(); };
    $('#qf-bug-cancel').onclick = () => { if (!busy) close(); };

    // Severidade padrao vem do storage (assincrono): nunca sobrescreve o que o QA ja escolheu.
    let severityTouched = false;
    $('#qf-bug-sev').addEventListener('change', () => { severityTouched = true; });
    getStorage(['runnerBugSeverity'], (d) => {
        if (!severityTouched) $('#qf-bug-sev').value = normalizeSeverity(d.runnerBugSeverity) || 'medium';
    });
    $('#qf-bug-name').focus();

    $('#qf-bug-submit').onclick = () => {
        if (busy) return;
        const title = $('#qf-bug-name').value.trim();
        if (!title) { $('#qf-bug-msg').textContent = 'Informe um título.'; return; }
        const severity = $('#qf-bug-sev').value;
        const label = SEVERITIES.find((s) => s.key === severity)?.label;
        const got = $('#qf-bug-got').value;
        res.comment = got; // mantem o texto no passo

        const html = buildBugReproHtml({
            tc, stepIndex: stepIdx, comment: got, steps: st.stepResults[tc.id], severityLabel: label,
            environment: $('#qf-bug-env').checked ? buildEnvironmentText(environmentInfo()) : '',
            probeText: $('#qf-bug-probe').checked ? formatProbeEvents(probeEvents, (t) => new Date(t).toLocaleTimeString('pt-BR')) : '',
            evidenceNames: $('#qf-bug-img').checked ? images.map((e) => e.name) : []
        });
        const attachments = $('#qf-bug-img').checked
            ? images.map((e) => ({ fileName: e.name, base64Content: e.dataUrl.slice(e.dataUrl.indexOf(',') + 1) }))
            : [];

        busy = true;
        $('#qf-bug-submit').disabled = true;
        $('#qf-bug-submit').textContent = 'Criando...';
        $('#qf-bug-msg').textContent = '';
        setStorage({ runnerBugSeverity: severity });

        sendRuntimeMessage({
            action: RuntimeActions.CREATE_BUG,
            title,
            comment: html,
            testCaseId: tc.id,
            workItemId: S.activeSession.workItemId,
            severity,
            attachments
        }, (reply) => {
            busy = false;
            if (reply && reply.bugId) {
                recordBug(reply.bugId, tc.id);
                close();
                showToast(`Bug #${reply.bugId} criado e vinculado ao PBI.`, { kind: 'success' });
                if (reply.attachmentErrors && reply.attachmentErrors.length) {
                    showToast(`${reply.attachmentErrors.length} anexo(s) não foram enviados ao bug.`, { kind: 'warn' });
                }
            } else {
                $('#qf-bug-submit').disabled = false;
                $('#qf-bug-submit').textContent = 'Criar bug';
                $('#qf-bug-msg').textContent = `Erro ao criar bug: ${reply?.error || 'sem resposta'}`;
                $('#qf-bug-msg').classList.add('is-error');
            }
        });
    };
}
