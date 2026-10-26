import { S } from './state.js';
import { openEvidencePanel } from './evidencePanel.js';

export function getEvidenceListFor(tcId, stepIdx) {
    if (!S.runnerState?.evidences) return [];
    const key = stepIdx !== null && stepIdx !== undefined
        ? `${tcId}_step_${stepIdx}`
        : String(tcId);
    return S.runnerState.evidences[key] || [];
}

function summarizeEvidence(list) {
    const total = list.length;
    const uploaded = list.filter(e => e.status === 'uploaded').length;
    const errors = list.filter(e => e.status === 'error').length;
    const pending = list.filter(e => e.status === 'uploading' || e.status === 'pending').length;
    return { total, uploaded, errors, pending };
}

function shortEvidenceName(name) {
    if (!name) return 'anexo';
    if (name.length <= 28) return name;
    const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')) : '';
    return name.slice(0, 18) + '…' + ext;
}

export function buildEvidenceButtonHtml(list, opts = {}) {
    const sum = summarizeEvidence(list);
    const hasAny = sum.total > 0;
    const hasUploaded = sum.uploaded > 0;
    const hasError = sum.errors > 0;
    const stateClass = hasError ? 'is-error' : hasUploaded ? 'is-uploaded' : hasAny ? 'is-pending' : 'is-empty';
    const idAttr = opts.id ? `id="${opts.id}"` : '';
    const dataAttr = opts.dataIdx !== undefined && opts.dataIdx !== null ? `data-idx="${opts.dataIdx}"` : '';
    const title = opts.title || 'Evidências';
    const countLabel = hasAny ? String(sum.total) : '';
    const mark = hasUploaded ? '✅' : hasError ? '❌' : hasAny ? '⏳' : '📸';
    const classNames = ['qualiflow-run-ev-btn', stateClass, opts.className].filter(Boolean).join(' ');
    return `<button type="button" ${idAttr} class="${classNames}" ${dataAttr} title="${title}" aria-label="${title}">
        ${mark}${countLabel ? ` <span class="qualiflow-run-ev-count">${countLabel}</span>` : ''}
    </button>`;
}

export function buildEvidenceStripHtml(list, scopeLabel) {
    if (!list || list.length === 0) return '';
    const sum = summarizeEvidence(list);
    const chips = list.map((ev, i) => {
        const icon = ev.type === 'video/webm' ? '🎬' : '🖼️';
        const st = ev.status === 'uploaded' ? '✅' : ev.status === 'error' ? '❌' : '⏳';
        const stateClass = ev.status === 'uploaded' ? 'is-uploaded' : ev.status === 'error' ? 'is-error' : 'is-pending';
        const safeTitle = String(ev.name || '').replace(/"/g, '&quot;');
        return `<span title="${safeTitle}" class="qualiflow-run-ev-chip ${stateClass}">
            <span>${icon}${st}</span>
            <span class="qualiflow-run-ev-chip-name">${shortEvidenceName(ev.name)}</span>
            <span class="qualiflow-run-ev-chip-idx">#${i + 1}</span>
        </span>`;
    }).join('');
    return `
      <div class="qualiflow-run-ev-strip">
        <div class="qualiflow-run-ev-strip-head">
          <span class="qualiflow-run-ev-strip-title">📎 Anexos · ${scopeLabel}</span>
          <span class="qualiflow-run-ev-strip-sum">${sum.uploaded}/${sum.total} no Azure${sum.errors ? ` · ${sum.errors} erro(s)` : ''}${sum.pending ? ` · ${sum.pending} enviando` : ''}</span>
        </div>
        <div class="qualiflow-run-ev-chips">${chips}</div>
      </div>`;
}

/** Refresh CT/step badges + strips without full re-render (keeps outcome/comment state). */
export function refreshEvidenceIndicators(tc) {
    if (!tc || !S.runnerState) return;

    const ctList = getEvidenceListFor(tc.id, null);
    const ctBtn = document.getElementById('qualiflow-evidence-btn');
    if (ctBtn) {
        const tmp = document.createElement('div');
        tmp.innerHTML = buildEvidenceButtonHtml(ctList, {
            id: 'qualiflow-evidence-btn',
            title: 'Evidências do CT (vários anexos permitidos)'
        });
        const next = tmp.firstElementChild;
        // preserve click by rebinding after replace
        ctBtn.replaceWith(next);
        next.addEventListener('click', () => {
            const textarea = document.getElementById('qualiflow-overall-comment');
            if (textarea) S.runnerState.comments[tc.id] = textarea.value;
            openEvidencePanel(tc, null);
        });
    }

    const ctStrip = document.getElementById('qualiflow-ct-evidence-strip');
    if (ctStrip) ctStrip.innerHTML = buildEvidenceStripHtml(ctList, 'CT');

    (tc.steps || []).forEach((s, idx) => {
        const list = getEvidenceListFor(tc.id, idx);
        const stepBtn = document.querySelector(`.step-evidence-btn[data-idx="${idx}"]`);
        if (stepBtn) {
            const tmp = document.createElement('div');
            tmp.innerHTML = buildEvidenceButtonHtml(list, {
                className: 'step-evidence-btn',
                dataIdx: idx,
                title: `Evidências do passo ${s.order} (vários anexos permitidos)`
            });
            const next = tmp.firstElementChild;
            stepBtn.replaceWith(next);
            next.addEventListener('click', (e) => {
                const btn = e.target.closest('.step-evidence-btn') || e.target;
                const i = parseInt(btn.getAttribute('data-idx'));
                openEvidencePanel(tc, i);
            });
        }
        const strip = document.querySelector(`.step-evidence-strip[data-idx="${idx}"]`);
        if (strip) strip.innerHTML = buildEvidenceStripHtml(list, `Passo ${s.order}`);
    });
}
