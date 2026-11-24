import { escapeHtml } from '../dashboard/helpers.js';
import { S } from './state.js';
import { buildEvidenceButtonHtml, buildEvidenceStripHtml, getEvidenceListFor } from './evidenceIndicators.js';
import { openEvidencePanel } from './evidencePanel.js';
import { sanitize } from './helpers.js';
import { finishCurrentTestCase, renderRunCompletedUI } from './runProgress.js';
import {
    enterCt, ensureTimerState, isPaused, leaveCt, pauseRun, resumeRun, runElapsedMs,
    startCtTimerIfNew, startTicker, takeStepDuration
} from './timers.js';
import { renderHeaderTimer } from './headerBar.js';
import { logEvent } from './runLog.js';
import { openBugDialog } from './bugDialog.js';
import { currentStepIndex, formatDuration, summarizeRun } from '../../../domain/runTimer.js';

const OUTCOME_LABELS = {
    None: 'Resultado geral',
    Passed: 'Aprovado',
    Failed: 'Reprovado',
    Blocked: 'Bloqueado',
    Paused: 'Pausado',
    NotApplicable: 'Não aplicável'
};
const STEP_BADGE = {
    None: { cls: 'is-pending', text: 'Pendente' },
    Passed: { cls: 'is-pass', text: 'Aprovado' },
    Failed: { cls: 'is-fail', text: 'Reprovado' }
};

function outcomeClass(value) {
    return `qualiflow-run-status-${String(value || 'None').toLowerCase()}`;
}

/** Guarda no estado o que esta digitado na tela (comentario geral) antes de re-renderizar/navegar. */
function persistLiveFields(tc) {
    const textarea = document.getElementById('qualiflow-overall-comment');
    if (textarea) S.runnerState.comments[tc.id] = textarea.value;
    const selectEl = document.getElementById('qualiflow-overall-outcome');
    if (selectEl && selectEl.value !== 'None') S.runnerState.overallOutcomes[tc.id] = selectEl.value;
}

function goToCt(fromTc, index) {
    if (isPaused()) return;
    persistLiveFields(fromTc);
    leaveCt(fromTc.id);
    S.runnerState.currentTcIndex = index;
    const next = S.runnerState.testCases[index];
    if (next) enterCt(next.id);
    renderExecutionUI();
}

function buildSummaryHtml() {
    const st = S.runnerState;
    const sum = summarizeRun(st.testCases, st.finalOutcomes, st.currentTcIndex);
    const chips = st.testCases.map((t, i) => {
        const outcome = st.finalOutcomes[t.id];
        const state = outcome === 'Passed' ? 'is-pass'
            : outcome === 'Failed' ? 'is-fail'
                : outcome && outcome !== 'None' ? 'is-other' : '';
        const current = i === st.currentTcIndex ? ' is-current' : '';
        const label = `CT ${i + 1}: #${t.id}${outcome ? ` (${OUTCOME_LABELS[outcome] || outcome})` : ''}`;
        return `<button type="button" class="qualiflow-run-chip ${state}${current}" data-ct-index="${i}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}"${i === st.currentTcIndex ? ' aria-current="step"' : ''}>${i + 1}</button>`;
    }).join('');

    return `
        <div class="qualiflow-run-summary">
            <div class="qualiflow-run-summary-row">
                <span class="qualiflow-run-summary-pos">CT <b>${st.currentTcIndex + 1}</b> de ${sum.total}</span>
                <span class="qualiflow-run-summary-total">Total <span id="qualiflow-run-timer" class="qualiflow-run-mono" role="timer" aria-live="off">${formatDuration(runElapsedMs())}</span></span>
                <span class="qualiflow-run-counters" role="group" aria-label="Resultados até agora">
                    <span class="qualiflow-run-counter is-pass" title="Aprovados" aria-label="${sum.passed} aprovados">${sum.passed}<small>A</small></span>
                    <span class="qualiflow-run-counter is-fail" title="Reprovados" aria-label="${sum.failed} reprovados">${sum.failed}<small>R</small></span>
                    <span class="qualiflow-run-counter is-other" title="Bloqueados ou outros" aria-label="${sum.blocked + sum.other} bloqueados ou outros">${sum.blocked + sum.other}<small>B</small></span>
                    <span class="qualiflow-run-counter" title="Pendentes" aria-label="${sum.pending} pendentes">${sum.pending}<small>P</small></span>
                </span>
            </div>
            <div class="qualiflow-run-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${sum.percent}" aria-label="Progresso da execução">
                <span style="width:${sum.percent}%"></span>
            </div>
            <div class="qualiflow-run-stepper" role="group" aria-label="Casos de teste">${chips}</div>
        </div>`;
}

export function renderExecutionUI() {
    const content = document.getElementById('qualiflow-runner-content');
    ensureTimerState();

    if (S.runnerState.currentTcIndex >= S.runnerState.testCases.length) {
        renderRunCompletedUI(content);
        return;
    }

    const tc = S.runnerState.testCases[S.runnerState.currentTcIndex];
    startCtTimerIfNew(tc.id);

    if (!S.runnerState.overallOutcomes) S.runnerState.overallOutcomes = {};
    if (!S.runnerState.comments) S.runnerState.comments = {};
    if (!S.runnerState.commentVisible) S.runnerState.commentVisible = {};

    const overallOutcome = S.runnerState.overallOutcomes[tc.id] || 'None';
    const commentVisible = S.runnerState.commentVisible[tc.id] || false;
    const currentComment = S.runnerState.comments[tc.id] || '';
    const isFirst = S.runnerState.currentTcIndex === 0;
    const paused = isPaused();

    const optionsHtml = Object.entries(OUTCOME_LABELS).map(([value, label]) =>
        `<option value="${value}" ${value === overallOutcome ? 'selected' : ''}>${label}</option>`
    ).join('');

    const ctEvidenceList = getEvidenceListFor(tc.id, null);
    const ctEvidenceBtn = buildEvidenceButtonHtml(ctEvidenceList, {
        id: 'qualiflow-evidence-btn',
        title: 'Evidências do caso de teste (vários anexos permitidos)'
    });

    content.innerHTML = `
        ${buildSummaryHtml()}

        <div class="qualiflow-card qualiflow-run-ct-card">
            <div class="qualiflow-run-id">CT #${tc.id}</div>
            <div class="qualiflow-run-ct-title">${sanitize(tc.title)}</div>
            <div id="qualiflow-ct-evidence-strip" class="qualiflow-u-mt-2">${buildEvidenceStripHtml(ctEvidenceList, 'CT')}</div>
        </div>
        ${paused ? '<div class="qualiflow-run-paused-banner" role="status">Teste pausado. O cronômetro está parado e as ações ficam bloqueadas até retomar.</div>' : ''}

        <div id="qualiflow-step-container"></div>

        <div class="qualiflow-run-actions">
            <div class="qualiflow-run-actions-main">
                <select id="qualiflow-overall-outcome" class="qualiflow-select-input qualiflow-run-outcome ${outcomeClass(overallOutcome)}" aria-label="Resultado geral do caso de teste">
                    ${optionsHtml}
                </select>
            </div>
            <div class="qualiflow-run-actions-btns">
                <button type="button" id="qualiflow-toggle-comment" class="qualiflow-btn-inline qualiflow-btn-sm qualiflow-run-tool-btn${commentVisible ? ' is-active' : ''}" aria-pressed="${commentVisible ? 'true' : 'false'}" title="Comentário geral da execução">Observação</button>
                ${ctEvidenceBtn}
            </div>
        </div>

        <div id="qualiflow-comment-block" class="qualiflow-run-comment${commentVisible ? '' : ' qualiflow-hidden'}">
            <textarea id="qualiflow-overall-comment" class="qualiflow-textarea-edit" aria-label="Comentário geral da execução" placeholder="Escreva o comentário geral da execução...">${escapeHtml(currentComment)}</textarea>
        </div>

        <div class="qualiflow-run-footer">
            <button type="button" id="qualiflow-prev-tc" class="qualiflow-btn-inline qualiflow-btn-sm qualiflow-run-tool-btn"${isFirst ? ' disabled' : ''}>Anterior</button>
            <button type="button" id="qualiflow-skip-tc" class="qualiflow-btn-inline qualiflow-btn-sm qualiflow-run-tool-btn" title="Avança sem gravar resultado deste CT">Pular</button>
            <div class="qualiflow-u-grow"></div>
            <button type="button" id="qualiflow-save-tc" class="qualiflow-btn-inline qualiflow-btn-success">Salvar e avançar</button>
        </div>
    `;
    renderStepsForExecution(tc);
    startTicker();
    renderHeaderTimer();

    if (paused) {
        // Pausa de verdade: nada alem de "Retomar" pode ser acionado enquanto o teste esta parado.
        ['.qualiflow-run-stepper', '.qualiflow-run-actions', '#qualiflow-comment-block', '#qualiflow-step-container', '.qualiflow-run-footer']
            .forEach((sel) => {
                const el = content.querySelector(sel);
                if (!el) return;
                el.setAttribute('inert', '');
                el.classList.add('is-locked');
            });
    }

    document.getElementById('qualiflow-overall-outcome').addEventListener('change', (e) => {
        if (isPaused()) return;
        S.runnerState.overallOutcomes[tc.id] = e.target.value;
        e.target.className = `qualiflow-select-input qualiflow-run-outcome ${outcomeClass(e.target.value)}`;
    });

    document.getElementById('qualiflow-evidence-btn').addEventListener('click', () => {
        if (isPaused()) return;
        persistLiveFields(tc);
        openEvidencePanel(tc, null);
    });

    document.getElementById('qualiflow-toggle-comment').addEventListener('click', () => {
        if (isPaused()) return;
        persistLiveFields(tc);
        S.runnerState.commentVisible[tc.id] = !S.runnerState.commentVisible[tc.id];
        renderExecutionUI();
    });

    document.getElementById('qualiflow-prev-tc').addEventListener('click', () => {
        if (S.runnerState.currentTcIndex > 0) goToCt(tc, S.runnerState.currentTcIndex - 1);
    });
    document.getElementById('qualiflow-skip-tc').addEventListener('click', () => {
        goToCt(tc, S.runnerState.currentTcIndex + 1);
    });
    content.querySelectorAll('[data-ct-index]').forEach((chip) => {
        chip.addEventListener('click', () => {
            const idx = Number(chip.getAttribute('data-ct-index'));
            if (idx !== S.runnerState.currentTcIndex) goToCt(tc, idx);
        });
    });

    document.getElementById('qualiflow-save-tc').addEventListener('click', saveCurrentCt);
}

function activeTc() {
    const st = S.runnerState;
    if (!st || !st.runId || st.currentTcIndex >= st.testCases.length) return null;
    return st.testCases[st.currentTcIndex];
}

/** Salva o CT atual no Azure e avanca (botao e atalho Alt+Shift+Enter). */
export function saveCurrentCt() {
    const tc = activeTc();
    if (!tc || isPaused()) return;
    persistLiveFields(tc);
    let finalOutcome = S.runnerState.overallOutcomes[tc.id] || 'None';
    if (finalOutcome === 'None') {
        const hasFailed = (S.runnerState.stepResults[tc.id] || []).some(s => s.outcome === 'Failed');
        finalOutcome = hasFailed ? 'Failed' : 'Passed';
    }
    finishCurrentTestCase(finalOutcome);
}

/** Passo-alvo dos atalhos: o primeiro sem resultado; se todos tem resultado, o ultimo. */
export function currentStepTarget() {
    const tc = activeTc();
    if (!tc || !tc.steps || tc.steps.length === 0) return null;
    const results = S.runnerState.stepResults[tc.id];
    if (!results) return null;
    const idx = currentStepIndex(results);
    return { tc, idx: idx >= 0 ? idx : results.length - 1 };
}

export function markCurrentStep(outcome) {
    const target = currentStepTarget();
    if (!target || isPaused()) return false;
    setStepOutcome(target.tc, target.idx, outcome);
    if (document.getElementById('qualiflow-step-container')) renderStepsForExecution(target.tc);
    if (outcome === 'Failed') document.querySelector(`.step-comment[data-idx="${target.idx}"]`)?.focus();
    return true;
}

export function openCurrentStepEvidence() {
    const target = currentStepTarget();
    if (!target || isPaused()) return false;
    persistLiveFields(target.tc);
    openEvidencePanel(target.tc, target.idx);
    return true;
}

/** Pausa/retoma a execucao (botao do cabecalho e camada de bloqueio). */
export function togglePause() {
    const st = S.runnerState;
    const tc = st?.testCases?.[st.currentTcIndex];
    if (!tc) return;
    if (isPaused()) {
        resumeRun();
    } else {
        if (S.mediaRecorder && S.mediaRecorder.state === 'recording') {
            alert('Pare a gravação de tela antes de pausar o teste.');
            return;
        }
        persistLiveFields(tc);
        pauseRun();
    }
    if (document.getElementById('qualiflow-runner-content')) renderExecutionUI();
}

function setStepOutcome(tc, idx, outcome) {
    if (isPaused()) return;
    const res = S.runnerState.stepResults[tc.id][idx];
    const next = res.outcome === outcome ? 'None' : outcome; // clicar de novo desfaz
    if (next !== 'None' && res.durationMs === undefined) {
        const st = S.runnerState;
        // inicio da janela de erros de console/rede deste passo = marcacao anterior (ou inicio do CT)
        res.windowStart = st.lastMarkAt[tc.id] || st.ctStartAt[tc.id] || (Date.now() - 10 * 60 * 1000);
        st.lastMarkAt[tc.id] = Date.now();
        res.durationMs = takeStepDuration(tc.id);
    }
    res.outcome = next;
    if (next !== 'None') {
        const label = next === 'Passed' ? 'aprovado' : 'reprovado';
        logEvent(`CT #${tc.id}, passo ${tc.steps[idx].order} ${label}${res.durationMs !== undefined ? ` (${formatDuration(res.durationMs)})` : ''}`);
    }
}

function renderStepsForExecution(tc) {
    const container = document.getElementById('qualiflow-step-container');
    if (!tc.steps || tc.steps.length === 0) {
        container.innerHTML = '<div class="qualiflow-empty">Sem passos descritos. Avalie e conclua abaixo.</div>';
        return;
    }

    if (!S.runnerState.stepResults[tc.id]) {
        S.runnerState.stepResults[tc.id] = tc.steps.map(s => ({ stepId: s.stepId || s.order, outcome: 'None', comment: '' }));
    }
    const results = S.runnerState.stepResults[tc.id];
    const currentIdx = currentStepIndex(results);
    const doneCount = results.filter(r => r.outcome && r.outcome !== 'None').length;

    const stepsHtml = tc.steps.map((s, idx) => {
        const res = results[idx];
        const badge = STEP_BADGE[res.outcome] || STEP_BADGE.None;
        const passActive = res.outcome === 'Passed';
        const failActive = res.outcome === 'Failed';
        const stepEvs = getEvidenceListFor(tc.id, idx);
        const stepEvBtn = buildEvidenceButtonHtml(stepEvs, {
            className: 'step-evidence-btn',
            dataIdx: idx,
            title: `Evidências do passo ${s.order} (vários anexos permitidos)`
        });
        const duration = res.durationMs !== undefined && res.outcome !== 'None'
            ? `<span class="qualiflow-run-step-time qualiflow-run-mono" title="Tempo gasto neste passo">${formatDuration(res.durationMs)}</span>` : '';
        const isCurrent = idx === currentIdx;

        return `
        <div class="qualiflow-exec-step qualiflow-run-step ${badge.cls}${isCurrent ? ' is-current' : ''}" data-step-idx="${idx}">
            <div class="qualiflow-run-step-head">
                <span class="qualiflow-run-step-num">${s.order}</span>
                <span class="qualiflow-run-step-title">Passo ${s.order}</span>
                <span class="qualiflow-run-step-badge ${badge.cls}">${badge.text}</span>
                ${isCurrent ? '<span class="qualiflow-run-step-now">Atual</span>' : ''}
                <span class="qualiflow-u-grow"></span>
                ${duration}
            </div>
            <div class="qualiflow-run-step-body">
                <div class="qualiflow-run-field">
                    <div class="qualiflow-run-field-label">Ação</div>
                    <div class="qualiflow-run-field-text">${sanitize(s.action) || '<span class="qualiflow-run-field-empty">Não informada</span>'}</div>
                </div>
                <div class="qualiflow-run-field qualiflow-run-field-expected">
                    <div class="qualiflow-run-field-label">Resultado esperado</div>
                    <div class="qualiflow-run-field-text">${sanitize(s.expected) || '<span class="qualiflow-run-field-empty">Não informado</span>'}</div>
                </div>
                <div class="step-evidence-strip qualiflow-run-step-strip" data-idx="${idx}">${buildEvidenceStripHtml(stepEvs, `Passo ${s.order}`)}</div>
            </div>
            <div class="qualiflow-run-step-actions">
                <button type="button" class="step-btn pass-btn qualiflow-btn-inline qualiflow-btn-sm qualiflow-run-step-btn${passActive ? ' is-active' : ''}" data-idx="${idx}" aria-pressed="${passActive}">Aprovar</button>
                <button type="button" class="step-btn fail-btn qualiflow-btn-inline qualiflow-btn-sm qualiflow-run-step-btn${failActive ? ' is-active' : ''}" data-idx="${idx}" aria-pressed="${failActive}">Reprovar</button>
                ${stepEvBtn}
            </div>
            ${res.outcome === 'Failed' ? `
                <div class="qualiflow-run-step-fail">
                    <textarea class="step-comment qualiflow-textarea-edit" data-idx="${idx}" aria-label="O que falhou no passo ${s.order}?" placeholder="Descreva o que aconteceu (resultado obtido)">${escapeHtml(res.comment || '')}</textarea>
                    <button type="button" class="step-bug-btn qualiflow-btn-inline qualiflow-btn-sm qualiflow-run-btn-danger-outline" data-idx="${idx}">Criar bug</button>
                </div>
            ` : ''}
        </div>
    `;
    }).join('');

    const remaining = tc.steps.length - doneCount;
    container.innerHTML = `
        <div class="qualiflow-run-steps-head">
            <span class="qualiflow-run-steps-title">Passos</span>
            <span class="qualiflow-run-steps-count">${doneCount} de ${tc.steps.length} avaliados</span>
            <span class="qualiflow-u-grow"></span>
            ${remaining > 0 ? '<button type="button" id="qualiflow-pass-remaining" class="qualiflow-btn-inline qualiflow-btn-sm qualiflow-run-tool-btn">Aprovar restantes</button>' : ''}
        </div>
        ${stepsHtml}`;

    const passRemaining = container.querySelector('#qualiflow-pass-remaining');
    if (passRemaining) {
        passRemaining.addEventListener('click', () => {
            if (isPaused()) return;
            results.forEach((r) => { if (r.outcome === 'None') r.outcome = 'Passed'; });
            renderStepsForExecution(tc);
        });
    }
    container.querySelectorAll('.step-btn.pass-btn').forEach(b => {
        b.addEventListener('click', () => {
            setStepOutcome(tc, Number(b.getAttribute('data-idx')), 'Passed');
            renderStepsForExecution(tc);
        });
    });
    container.querySelectorAll('.step-btn.fail-btn').forEach(b => {
        b.addEventListener('click', () => {
            setStepOutcome(tc, Number(b.getAttribute('data-idx')), 'Failed');
            renderStepsForExecution(tc);
        });
    });
    container.querySelectorAll('.step-comment').forEach(i => {
        i.addEventListener('input', (e) => {
            const idx = e.target.getAttribute('data-idx');
            results[idx].comment = e.target.value;
        });
    });
    container.querySelectorAll('.step-bug-btn').forEach(b => {
        b.addEventListener('click', (e) => {
            if (isPaused()) return;
            createBugForStep(tc, Number(e.currentTarget.getAttribute('data-idx')));
        });
    });
    container.querySelectorAll('.step-evidence-btn').forEach(b => {
        b.addEventListener('click', (e) => {
            if (isPaused()) return;
            const btn = e.target.closest('.step-evidence-btn') || e.target;
            openEvidencePanel(tc, parseInt(btn.getAttribute('data-idx')));
        });
    });
}

function createBugForStep(tc, stepIdx) {
    openBugDialog({ tc, stepIdx });
}
