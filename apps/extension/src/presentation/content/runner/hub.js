/*
 * HUB da execucao: painel flutuante (abre e fecha) com informacoes extras do teste em andamento:
 * tempos e estimativa, resultados, evidencias, bugs, ambiente para relatar bugs, atividade recente e notas.
 */
import { escapeHtml } from '../dashboard/helpers.js';
import { S } from './state.js';
import { setupDrag } from './helpers.js';
import { ctElapsedMs, isPaused, onTick, runElapsedMs } from './timers.js';
import { getEvidenceListFor } from './evidenceIndicators.js';
import {
    averageMs, buildEnvironmentText, describePauses, estimateRemainingMs, evidenceTotals, passRate
} from '../../../domain/runInsights.js';
import { formatDuration, summarizeRun } from '../../../domain/runTimer.js';
import { probeSummary } from './probeClient.js';
import { copyReportMarkdown, downloadReportHtml } from './runReportExport.js';
import { showToast } from './toast.js';
import { toggleConsole } from './consolePanel.js';
import { copyText, environmentInfo } from './envInfo.js';

const HUB_ID = 'qualiflow-hub';
let wired = false;
let copied = { key: '', until: 0 };

export function isHubOpen() {
    return !!document.getElementById(HUB_ID);
}

function syncButton() {
    const btn = document.getElementById('qualiflow-runner-hub');
    if (btn) btn.setAttribute('aria-pressed', isHubOpen() ? 'true' : 'false');
}

export function toggleHub() {
    if (isHubOpen()) closeHub(); else openHub();
}

export function closeHub() {
    document.getElementById(HUB_ID)?.remove();
    syncButton();
}

function openHub() {
    const hub = document.createElement('div');
    hub.id = HUB_ID;
    hub.className = 'qualiflow-root qualiflow-hub';
    hub.setAttribute('role', 'complementary');
    hub.setAttribute('aria-label', 'HUB da execução');
    hub.innerHTML = `
        <div class="qualiflow-hub-head" id="qualiflow-hub-head">
            <span class="qualiflow-hub-title">HUB da execução</span>
            <button type="button" class="qualiflow-close" id="qualiflow-hub-close" aria-label="Fechar HUB" title="Fechar">&times;</button>
        </div>
        <div class="qualiflow-hub-body">
            <div id="qualiflow-hub-dyn"></div>
            <section class="qualiflow-hub-section">
                <div class="qualiflow-hub-section-head">
                    <h3>Notas da sessão</h3>
                    <button type="button" class="qualiflow-hub-link" data-hub-copy="notes">Copiar</button>
                </div>
                <textarea id="qualiflow-hub-notes" class="qualiflow-textarea-edit" rows="3" placeholder="Anotações rápidas (não são enviadas ao Azure)"></textarea>
            </section>
        </div>`;
    document.body.appendChild(hub);
    hub.style.left = '24px';
    hub.style.top = '72px';
    setupDrag(hub, hub.querySelector('#qualiflow-hub-head'));

    const notes = hub.querySelector('#qualiflow-hub-notes');
    notes.value = S.hubNotes || '';
    notes.addEventListener('input', () => { S.hubNotes = notes.value; });
    hub.querySelector('#qualiflow-hub-close').addEventListener('click', closeHub);
    hub.addEventListener('click', onHubClick);

    if (!wired) {
        wired = true;
        onTick(refreshHub);
        document.addEventListener('qualiflow:run-state', refreshHub);
    }
    syncButton();
    refreshHub();
}

function eventsText() {
    return (S.runnerState?.events || [])
        .map((e) => `${new Date(e.at).toLocaleTimeString('pt-BR')}  ${e.text}`).join('\n');
}

function onHubClick(e) {
    if (e.target.closest('[data-hub-console]')) { toggleConsole(); return; }
    const report = e.target.closest('[data-hub-report]');
    if (report) {
        if (!runActive()) { showToast('Inicie uma execução para gerar o relatório.', { kind: 'warn' }); return; }
        if (report.dataset.hubReport === 'md') {
            copyReportMarkdown().then(() => showToast('Relatório (Markdown) copiado.', { kind: 'success' }));
        } else {
            downloadReportHtml();
        }
        return;
    }
    const btn = e.target.closest('[data-hub-copy]');
    if (!btn) return;
    const key = btn.getAttribute('data-hub-copy');
    const text = key === 'env' ? buildEnvironmentText(environmentInfo())
        : key === 'events' ? eventsText()
            : (S.hubNotes || '');
    copyText(text).then(() => {
        copied = { key, until: Date.now() + 1500 };
        refreshHub();
        setTimeout(refreshHub, 1600);
    });
}

const copyLabel = (key) => (copied.key === key && Date.now() < copied.until ? 'Copiado' : 'Copiar');
const kv = (k, v, title = '') => `<div class="qualiflow-hub-kv"><dt>${k}</dt><dd${title ? ` title="${escapeHtml(title)}"` : ''}>${v}</dd></div>`;

function runActive() {
    const st = S.runnerState;
    return !!(st && st.runId && st.testCases);
}

function buildRunSections() {
    const st = S.runnerState;
    const tc = st.testCases[st.currentTcIndex];
    const sum = summarizeRun(st.testCases, st.finalOutcomes || {}, st.currentTcIndex);
    const durations = Object.values(st.ctDurations || {});
    const avg = averageMs(durations);
    const eta = estimateRemainingMs(avg, st.testCases.length - sum.done);
    const rate = passRate(sum);
    const stepResults = tc ? (st.stepResults?.[tc.id] || []) : [];
    const stepsDone = stepResults.filter((s) => s.outcome && s.outcome !== 'None').length;
    const stepsFailed = stepResults.filter((s) => s.outcome === 'Failed').length;
    const allLists = Object.values(st.evidences || {});
    const ev = evidenceTotals(allLists);
    const ctEv = tc ? getEvidenceListFor(tc.id, null).length : 0;
    const bugs = st.bugs || [];

    const execution = `
        <section class="qualiflow-hub-section">
            <h3>Execução</h3>
            <dl class="qualiflow-hub-grid">
                ${kv('Sessão', `PBI #${escapeHtml(S.activeSession?.workItemId ?? '-')}`, S.activeSession?.workItemTitle || '')}
                ${kv('Início', new Date(st.startedAt || Date.now()).toLocaleTimeString('pt-BR'))}
                ${kv('Tempo total', `<span class="qualiflow-run-mono">${formatDuration(runElapsedMs())}</span>`)}
                ${kv('Tempo do CT', `<span class="qualiflow-run-mono">${tc ? formatDuration(ctElapsedMs(tc.id)) : '--'}</span>`)}
                ${kv('Média por CT', avg === null ? 'Sem dados' : `<span class="qualiflow-run-mono">${formatDuration(avg)}</span> (${durations.length})`)}
                ${kv('Tempo restante (estimado)', eta === null ? 'Conclua um CT' : `<span class="qualiflow-run-mono">${formatDuration(eta)}</span>`)}
                ${kv('Pausas', describePauses(st.pauseCount || 0, st.pausedMs || 0) + (isPaused() ? ' (pausado agora)' : ''))}
            </dl>
        </section>`;

    const results = `
        <section class="qualiflow-hub-section">
            <h3>Resultados</h3>
            <dl class="qualiflow-hub-grid">
                ${kv('Concluídos', `${sum.done} de ${sum.total} (${sum.percent}%)`)}
                ${kv('Taxa de aprovação', rate === null ? '--' : `${rate}%`)}
                ${kv('Aprovados', String(sum.passed))}
                ${kv('Reprovados', String(sum.failed))}
                ${kv('Bloqueados/outros', String(sum.blocked + sum.other))}
                ${kv('Pendentes', String(sum.pending))}
            </dl>
        </section>
        <section class="qualiflow-hub-section">
            <h3>CT atual${tc ? ` #${tc.id}` : ''}</h3>
            <dl class="qualiflow-hub-grid">
                ${kv('Passos avaliados', `${stepsDone} de ${stepResults.length || (tc?.steps?.length ?? 0)}`)}
                ${kv('Passos reprovados', String(stepsFailed))}
                ${kv('Evidências do CT', String(ctEv))}
            </dl>
        </section>
        <section class="qualiflow-hub-section">
            <h3>Evidências e bugs</h3>
            <dl class="qualiflow-hub-grid">
                ${kv('Anexos na execução', String(ev.total))}
                ${kv('Enviados ao Azure', String(ev.uploaded))}
                ${kv('Enviando', String(ev.pending))}
                ${kv('Com erro', `<span class="${ev.error ? 'is-bad' : ''}">${ev.error}</span>`)}
            </dl>
            <div class="qualiflow-hub-probe">${probeLine()}</div>
            <div class="qualiflow-hub-bugs">${bugs.length
        ? bugs.map((b) => `<span class="qualiflow-hub-pill">Bug #${escapeHtml(b.id)} &middot; CT #${escapeHtml(b.tcId)}</span>`).join('')
        : '<span class="qualiflow-hub-muted">Nenhum bug criado nesta execução.</span>'}</div>
        </section>`;
    return execution + results;
}

function probeLine() {
    if (!S.probeEnabled) return '<span class="qualiflow-hub-muted">Captura de console e rede desligada (engrenagem).</span>';
    const p = probeSummary();
    return `<span class="qualiflow-hub-probe-item${p.errors ? ' is-bad' : ''}">${p.errors} erro(s) de console</span>` +
        `<span class="qualiflow-hub-probe-item${p.failedRequests ? ' is-bad' : ''}">${p.failedRequests} requisição(ões) com falha</span>` +
        `<span class="qualiflow-hub-probe-item">${p.warnings} aviso(s)</span>` +
        '<button type="button" class="qualiflow-hub-link" data-hub-console>Abrir console</button>';
}

function buildReportSection() {
    return `
        <section class="qualiflow-hub-section">
            <div class="qualiflow-hub-section-head"><h3>Relatório da execução</h3></div>
            <div class="qualiflow-hub-actions-row">
                <button type="button" class="qualiflow-hub-btn" data-hub-report="md">Copiar Markdown</button>
                <button type="button" class="qualiflow-hub-btn" data-hub-report="html">Baixar HTML</button>
            </div>
        </section>`;
}

function buildEnvironmentSection() {
    const env = environmentInfo();
    const short = env.url.length > 60 ? `${env.url.slice(0, 57)}...` : env.url;
    return `
        <section class="qualiflow-hub-section">
            <div class="qualiflow-hub-section-head">
                <h3>Ambiente</h3>
                <button type="button" class="qualiflow-hub-link" data-hub-copy="env" title="Copia os dados abaixo, prontos para colar em um bug">${copyLabel('env')}</button>
            </div>
            <dl class="qualiflow-hub-grid">
                ${kv('URL', escapeHtml(short), env.url)}
                ${kv('Navegador', escapeHtml(env.browser))}
                ${kv('Sistema', escapeHtml(env.os))}
                ${kv('Janela', `${escapeHtml(env.viewport)} (${escapeHtml(env.breakpoint)})`)}
                ${kv('Tela', `${escapeHtml(env.screen)} (${escapeHtml(env.pixelRatio)})`)}
                ${kv('Idioma / fuso', `${escapeHtml(env.language)} / ${escapeHtml(env.timezone)}`)}
            </dl>
        </section>`;
}

function buildActivitySection() {
    const events = (S.runnerState?.events || []).slice(-12).reverse();
    return `
        <section class="qualiflow-hub-section">
            <div class="qualiflow-hub-section-head">
                <h3>Atividade recente</h3>
                ${events.length ? `<button type="button" class="qualiflow-hub-link" data-hub-copy="events">${copyLabel('events')}</button>` : ''}
            </div>
            ${events.length
        ? `<ul class="qualiflow-hub-events">${events.map((e) => `<li><time class="qualiflow-run-mono">${new Date(e.at).toLocaleTimeString('pt-BR')}</time><span>${escapeHtml(e.text)}</span></li>`).join('')}</ul>`
        : '<span class="qualiflow-hub-muted">Sem atividade ainda.</span>'}
        </section>`;
}

export function refreshHub() {
    const dyn = document.getElementById('qualiflow-hub-dyn');
    if (!dyn) return;
    const body = runActive()
        ? buildRunSections()
        : '<section class="qualiflow-hub-section"><span class="qualiflow-hub-muted">Nenhuma execução em andamento. Inicie uma execução para ver tempos, resultados e estimativas.</span></section>';
    dyn.innerHTML = body + buildEnvironmentSection() + (runActive() ? buildActivitySection() + buildReportSection() : '');
}
