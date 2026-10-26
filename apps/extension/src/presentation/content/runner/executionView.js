import { sendRuntimeMessage } from '../shared/runtime.js';
import { escapeHtml } from '../dashboard/helpers.js';
import { S } from './state.js';
import { buildEvidenceButtonHtml, buildEvidenceStripHtml, getEvidenceListFor } from './evidenceIndicators.js';
import { openEvidencePanel } from './evidencePanel.js';
import { sanitize } from './helpers.js';
import { finishCurrentTestCase, renderRunCompletedUI } from './runProgress.js';
import { RuntimeActions } from '../../../contracts/runtimeActions.js';

function outcomeClass(value) {
    return `qualiflow-run-status-${String(value || 'None').toLowerCase()}`;
}

export function renderExecutionUI() {
    const content = document.getElementById('qualiflow-runner-content');

    if (S.runnerState.currentTcIndex >= S.runnerState.testCases.length) {
        renderRunCompletedUI(content);
        return;
    }

    const tc = S.runnerState.testCases[S.runnerState.currentTcIndex];
    const progress = `${S.runnerState.currentTcIndex + 1} de ${S.runnerState.testCases.length}`;

    // Safely retrieve toggle/outcome states (with fallbacks for resumed sessions)
    if (!S.runnerState.overallOutcomes) S.runnerState.overallOutcomes = {};
    if (!S.runnerState.comments) S.runnerState.comments = {};
    if (!S.runnerState.commentVisible) S.runnerState.commentVisible = {};

    const overallOutcome = S.runnerState.overallOutcomes[tc.id] || 'None';
    const commentVisible = S.runnerState.commentVisible[tc.id] || false;
    const currentComment = S.runnerState.comments[tc.id] || '';

    const OUTCOME_OPTS = [
        { value: 'None', label: '— Resultado Geral —' },
        { value: 'Passed', label: '✅ Passed' },
        { value: 'Failed', label: '❌ Failed' },
        { value: 'Blocked', label: '🚫 Blocked' },
        { value: 'Paused', label: '⏸ Paused' },
        { value: 'NotApplicable', label: '⊘ Not Applicable' },
    ];
    const optionsHtml = OUTCOME_OPTS.map(o =>
        `<option value="${o.value}" ${o.value === overallOutcome ? 'selected' : ''}>${o.label}</option>`
    ).join('');

    const ctEvidenceList = getEvidenceListFor(tc.id, null);
    const ctEvidenceBtn = buildEvidenceButtonHtml(ctEvidenceList, {
        id: 'qualiflow-evidence-btn',
        title: 'Evidências do CT (vários anexos permitidos)'
    });

    const html = `
        <div class="qualiflow-run-topbar">
            <span class="qualiflow-run-topbar-label">Em Execução</span>
            <span class="qualiflow-badge qualiflow-badge-neutral">${progress}</span>
        </div>

        <div class="qualiflow-card qualiflow-run-ct-card">
            <div class="qualiflow-run-id">CT #${tc.id}</div>
            <div class="qualiflow-run-ct-title">${sanitize(tc.title)}</div>
            <div id="qualiflow-ct-evidence-strip" class="qualiflow-u-mt-2">${buildEvidenceStripHtml(ctEvidenceList, 'CT')}</div>
        </div>

        <!-- Top Actions & Selector bar -->
        <div class="qualiflow-run-actions">
            <div class="qualiflow-run-actions-main">
                <select id="qualiflow-overall-outcome" class="qualiflow-select-input qualiflow-run-outcome ${outcomeClass(overallOutcome)}" aria-label="Resultado geral do CT">
                    ${optionsHtml}
                </select>
            </div>

            <div class="qualiflow-run-actions-btns">
                <button type="button" id="qualiflow-toggle-comment" class="qualiflow-btn-inline qualiflow-btn-sm qualiflow-run-tool-btn${commentVisible ? ' is-active' : ''}" aria-pressed="${commentVisible ? 'true' : 'false'}" title="Adicionar Comentário Geral">
                    💬 Obs
                </button>
                ${ctEvidenceBtn}
                <button type="button" id="qualiflow-save-tc" class="qualiflow-btn-inline qualiflow-btn-sm qualiflow-btn-success">
                    Salvar
                </button>
            </div>
        </div>

        <!-- Toggleable Comment Box -->
        <div id="qualiflow-comment-block" class="qualiflow-run-comment${commentVisible ? '' : ' qualiflow-hidden'}">
            <textarea id="qualiflow-overall-comment" class="qualiflow-textarea-edit" aria-label="Comentário geral da execução" placeholder="Escreva o comentário geral da execução...">${escapeHtml(currentComment)}</textarea>
        </div>

        <div id="qualiflow-step-container"></div>
    `;

    content.innerHTML = html;
    renderStepsForExecution(tc);

    // Bind events for top selectors and controllers
    document.getElementById('qualiflow-overall-outcome').addEventListener('change', (e) => {
        S.runnerState.overallOutcomes[tc.id] = e.target.value;
        // Re-style the border/color without a full re-render for UX smoothness
        e.target.className = `qualiflow-select-input qualiflow-run-outcome ${outcomeClass(e.target.value)}`;
    });

    document.getElementById('qualiflow-evidence-btn').addEventListener('click', () => {
        const textarea = document.getElementById('qualiflow-overall-comment');
        if (textarea) S.runnerState.comments[tc.id] = textarea.value;
        openEvidencePanel(tc, null);
    });

    document.getElementById('qualiflow-toggle-comment').addEventListener('click', () => {
        // Keep comment before re-rendering
        const textarea = document.getElementById('qualiflow-overall-comment');
        if (textarea) S.runnerState.comments[tc.id] = textarea.value;

        S.runnerState.commentVisible[tc.id] = !S.runnerState.commentVisible[tc.id];
        renderExecutionUI();
    });

    document.getElementById('qualiflow-save-tc').addEventListener('click', () => {
        // Save comment state
        const textarea = document.getElementById('qualiflow-overall-comment');
        if (textarea) S.runnerState.comments[tc.id] = textarea.value;

        // Also capture the select's current value (user may have changed it without triggering change)
        const selectEl = document.getElementById('qualiflow-overall-outcome');
        if (selectEl && selectEl.value !== 'None') S.runnerState.overallOutcomes[tc.id] = selectEl.value;

        let finalOutcome = S.runnerState.overallOutcomes[tc.id] || 'None';
        if (finalOutcome === 'None') {
            const hasFailed = (S.runnerState.stepResults[tc.id] || []).some(s => s.outcome === 'Failed');
            finalOutcome = hasFailed ? 'Failed' : 'Passed';
        }
        finishCurrentTestCase(finalOutcome);
    });
}

function renderStepsForExecution(tc) {
    const container = document.getElementById('qualiflow-step-container');
    if (!tc.steps || tc.steps.length === 0) {
        container.innerHTML = '<div class="qualiflow-empty">Sem steps descritos. Avalie e conclua abaixo.</div>';
        return;
    }

    // Initialize state for steps if not present
    if (!S.runnerState.stepResults[tc.id]) {
        S.runnerState.stepResults[tc.id] = tc.steps.map(s => ({ stepId: s.stepId || s.order, outcome: 'None', comment: '' }));
    }

    const stepsHtml = tc.steps.map((s, idx) => {
        const res = S.runnerState.stepResults[tc.id][idx];
        const passActive = res.outcome === 'Passed';
        const failActive = res.outcome === 'Failed';
        const stepEvs = getEvidenceListFor(tc.id, idx);
        const stepEvBtn = buildEvidenceButtonHtml(stepEvs, {
            className: 'step-evidence-btn',
            dataIdx: idx,
            title: `Evidências do passo ${s.order} (vários anexos permitidos)`
        });

        return `
        <div class="qualiflow-exec-step qualiflow-run-step" data-step-idx="${idx}">
            <div class="qualiflow-run-step-row">
                <div class="qualiflow-run-step-num">${s.order}</div>
                <div class="qualiflow-run-step-main">
                    <div class="qualiflow-run-step-action">${sanitize(s.action)}</div>
                    ${s.expected ? `<div class="qualiflow-run-expected">Exp: ${sanitize(s.expected)}</div>` : ''}
                    <div class="step-evidence-strip qualiflow-run-step-strip" data-idx="${idx}">${buildEvidenceStripHtml(stepEvs, `Passo ${s.order}`)}</div>
                </div>
                <div class="qualiflow-run-step-actions">
                     <button type="button" class="step-btn pass-btn qualiflow-btn-inline qualiflow-btn-sm qualiflow-run-step-btn${passActive ? ' is-active' : ''}" data-idx="${idx}" aria-pressed="${passActive}">&#x2705; Pass</button>
                     <button type="button" class="step-btn fail-btn qualiflow-btn-inline qualiflow-btn-sm qualiflow-run-step-btn${failActive ? ' is-active' : ''}" data-idx="${idx}" aria-pressed="${failActive}">&#x274C; Fail</button>
                     ${stepEvBtn}
                </div>
            </div>
            ${res.outcome === 'Failed' ? `
                <div class="qualiflow-run-step-fail">
                    <textarea class="step-comment qualiflow-textarea-edit" data-idx="${idx}" aria-label="O que falhou no passo ${s.order}?" placeholder="O que falhou no passo?">${escapeHtml(res.comment || '')}</textarea>
                    <button type="button" class="step-bug-btn qualiflow-btn-inline qualiflow-btn-sm qualiflow-run-btn-danger-outline" data-idx="${idx}">&#x1F41B; Criar Bug</button>
                </div>
            ` : ''}
        </div>
    `}).join('');

    container.innerHTML = stepsHtml;

    // Attach listeners
    container.querySelectorAll('.step-btn.pass-btn').forEach(b => {
        b.addEventListener('click', (e) => {
            const idx = e.target.getAttribute('data-idx');
            S.runnerState.stepResults[tc.id][idx].outcome = 'Passed';
            renderStepsForExecution(tc); // poor man's react
        });
    });
    container.querySelectorAll('.step-btn.fail-btn').forEach(b => {
        b.addEventListener('click', (e) => {
            const idx = e.target.getAttribute('data-idx');
            S.runnerState.stepResults[tc.id][idx].outcome = 'Failed';
            renderStepsForExecution(tc);
        });
    });
    container.querySelectorAll('.step-comment').forEach(i => {
        i.addEventListener('input', (e) => {
            const idx = e.target.getAttribute('data-idx');
            S.runnerState.stepResults[tc.id][idx].comment = e.target.value;
        });
    });
    container.querySelectorAll('.step-bug-btn').forEach(b => {
        b.addEventListener('click', (e) => {
            const idx = e.target.getAttribute('data-idx');
            const comment = S.runnerState.stepResults[tc.id][idx].comment || 'Falha no passo ' + tc.steps[idx].order;
            createBugForStep(tc, idx, comment);
        });
    });
    container.querySelectorAll('.step-evidence-btn').forEach(b => {
        b.addEventListener('click', (e) => {
            const btn = e.target.closest('.step-evidence-btn') || e.target;
            const idx = parseInt(btn.getAttribute('data-idx'));
            openEvidencePanel(tc, idx);
        });
    });
}

function createBugForStep(tc, stepIdx, comment) {
    const step = tc.steps[stepIdx];
    const content = document.getElementById('qualiflow-runner-content');
    const overlay = document.createElement('div');
    overlay.className = 'qualiflow-run-busy';
    overlay.setAttribute('role', 'status');
    overlay.innerHTML = '<div class="qualiflow-run-busy-box">Criando Bug no Azure...</div>';
    content.appendChild(overlay);

    const bugTitle = `[BUG] Falha na execução do CT ${tc.id}: Passo ${step.order}`;
    const bugComment = `**Passo:** ${sanitize(step.action)}\n**Esperado:** ${sanitize(step.expected)}\n\n**O que aconteceu:**\n${comment}`;

    sendRuntimeMessage({
        action: RuntimeActions.CREATE_BUG,
        title: bugTitle,
        comment: bugComment,
        testCaseId: tc.id,
        workItemId: S.activeSession.workItemId
    }, (res) => {
        content.removeChild(overlay);
        if (res && res.bugId) {
            alert(`Bug #${res.bugId} criado e associado ao PBI!`);
        } else {
            alert(`Erro ao criar bug: ${res?.error}`);
        }
    });
}
