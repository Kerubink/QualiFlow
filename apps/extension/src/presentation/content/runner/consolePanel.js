/*
 * Console integrado: painel flutuante (como o HUB) com os erros de console, excecoes e requisicoes com falha
 * capturados pela sonda. Filtros, busca, detalhe expansivel, "Limpar" (so esconde da lista) e "Copiar".
 * Regras de filtro/formatacao em domain/probeEvents.js.
 */
import { escapeHtml } from '../dashboard/helpers.js';
import { S } from './state.js';
import { setupDrag } from './helpers.js';
import { copyText } from './envInfo.js';
import { showToast } from './toast.js';
import { isProbeActive, startProbe } from './probeClient.js';
import {
    PROBE_FILTERS, countByCategory, eventCategory, eventDetail, eventSummary, eventTag, filterEvents, formatProbeEvents, unseenCount
} from '../../../domain/probeEvents.js';

const PANEL_ID = 'qualiflow-console';
const FILTERS = [
    { key: PROBE_FILTERS.ALL, label: 'Todos', count: 'all' },
    { key: PROBE_FILTERS.ERRORS, label: 'Erros', count: 'errors' },
    { key: PROBE_FILTERS.WARNINGS, label: 'Avisos', count: 'warnings' },
    { key: PROBE_FILTERS.NETWORK, label: 'Rede', count: 'network' }
];

let filter = PROBE_FILTERS.ALL;
let query = '';
let follow = true;
let clearedAt = 0;
let seenAt = Date.now();
let expanded = new Set();
let wired = false;
let rafPending = false;

const fmtTime = (t) => new Date(t).toLocaleTimeString('pt-BR');
const visibleEvents = () => filterEvents(S.probeEvents, { filter, query, sinceMs: clearedAt });

export function isConsoleOpen() {
    return !!document.getElementById(PANEL_ID);
}

/** Contador do botao do cabecalho: erros e requisicoes com falha que chegaram desde a ultima vez que o painel foi visto. */
export function updateConsoleBadge() {
    const badge = document.getElementById('qualiflow-console-badge');
    const btn = document.getElementById('qualiflow-runner-console');
    if (btn) btn.setAttribute('aria-pressed', isConsoleOpen() ? 'true' : 'false');
    if (!badge) return;
    const n = isConsoleOpen() ? 0 : unseenCount(S.probeEvents.filter((e) => e.t >= clearedAt), seenAt);
    badge.hidden = n === 0;
    badge.textContent = n > 99 ? '99+' : String(n);
    if (btn) btn.title = n ? `Console (${n} novo${n === 1 ? '' : 's'})` : 'Console';
}

export function toggleConsole() {
    if (isConsoleOpen()) closeConsole(); else openConsole();
}

export function closeConsole() {
    document.getElementById(PANEL_ID)?.remove();
    seenAt = Date.now();
    updateConsoleBadge();
}

function openConsole() {
    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.className = 'qualiflow-root qualiflow-console';
    panel.setAttribute('role', 'complementary');
    panel.setAttribute('aria-label', 'Console');
    panel.innerHTML = `
        <div class="qualiflow-console-head" id="qualiflow-console-head">
            <span class="qualiflow-hub-title">Console</span>
            <span class="qualiflow-u-grow"></span>
            <button type="button" class="qualiflow-hub-btn" id="qualiflow-console-copy" title="Copia as linhas visíveis">Copiar</button>
            <button type="button" class="qualiflow-hub-btn" id="qualiflow-console-clear" title="Esconde as linhas atuais (os eventos continuam disponíveis para novos bugs)">Limpar</button>
            <button type="button" class="qualiflow-close" id="qualiflow-console-close" aria-label="Fechar console" title="Fechar">&times;</button>
        </div>
        <div class="qualiflow-console-bar">
            <div class="qualiflow-console-filters" role="group" aria-label="Filtrar eventos">
                ${FILTERS.map((f) => `<button type="button" class="qualiflow-console-chip" data-filter="${f.key}" aria-pressed="false">${f.label} <span data-count="${f.count}">0</span></button>`).join('')}
            </div>
            <input type="search" id="qualiflow-console-search" class="qualiflow-console-search" placeholder="Buscar..." aria-label="Buscar nos eventos">
        </div>
        <div id="qualiflow-console-note" class="qualiflow-console-note" hidden></div>
        <ul id="qualiflow-console-list" class="qualiflow-console-list" aria-live="polite"></ul>
        <div class="qualiflow-console-foot">
            <span id="qualiflow-console-status"></span>
            <span class="qualiflow-u-grow"></span>
            <label><input type="checkbox" id="qualiflow-console-follow"> Seguir novos eventos</label>
        </div>`;
    document.body.appendChild(panel);
    panel.style.left = '24px';
    panel.style.bottom = '24px';
    setupDrag(panel, panel.querySelector('#qualiflow-console-head'), {
        onStart: () => { panel.style.bottom = 'auto'; }
    });

    const search = panel.querySelector('#qualiflow-console-search');
    search.value = query;
    const followBox = panel.querySelector('#qualiflow-console-follow');
    followBox.checked = follow;
    followBox.addEventListener('change', () => { follow = followBox.checked; scheduleRefresh(); });
    search.addEventListener('input', () => { query = search.value; refreshConsole(); });
    panel.querySelector('#qualiflow-console-close').addEventListener('click', closeConsole);
    panel.querySelector('#qualiflow-console-clear').addEventListener('click', () => {
        clearedAt = Date.now();
        expanded = new Set();
        refreshConsole();
    });
    panel.querySelector('#qualiflow-console-copy').addEventListener('click', () => {
        const events = visibleEvents();
        if (!events.length) { showToast('Não há eventos para copiar.', { kind: 'warn', timeout: 2500 }); return; }
        copyText(formatProbeEvents(events, fmtTime)).then(() => showToast(`${events.length} linha(s) copiada(s).`, { kind: 'success', timeout: 2500 }));
    });
    panel.querySelectorAll('[data-filter]').forEach((btn) => {
        btn.addEventListener('click', () => { filter = btn.dataset.filter; refreshConsole(); });
    });
    panel.querySelector('#qualiflow-console-list').addEventListener('click', (e) => {
        const row = e.target.closest('[data-id]');
        if (!row) return;
        const id = Number(row.dataset.id);
        if (expanded.has(id)) expanded.delete(id); else expanded.add(id);
        refreshConsole();
    });
    panel.addEventListener('click', (e) => {
        if (e.target.closest('#qualiflow-console-enable')) { startProbe(); refreshConsole(); }
    });

    if (!wired) {
        wired = true;
        document.addEventListener('qualiflow:probe-event', () => { scheduleRefresh(); updateConsoleBadge(); });
    }
    seenAt = Date.now();
    refreshConsole();
    updateConsoleBadge();
    search.focus();
}

function scheduleRefresh() {
    if (rafPending || !isConsoleOpen()) return;
    rafPending = true;
    requestAnimationFrame(() => { rafPending = false; refreshConsole(); });
}

function noteHtml() {
    if (!S.probeEnabled) return 'A captura de console e rede está desligada (engrenagem &gt; Capturar console e rede).';
    if (!isProbeActive()) return 'A captura começa quando uma execução é iniciada. <button type="button" class="qualiflow-hub-link" id="qualiflow-console-enable">Ativar captura agora</button>';
    return '';
}

export function refreshConsole() {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    const base = S.probeEvents.filter((e) => e.t >= clearedAt);
    const counts = countByCategory(base);
    panel.querySelectorAll('[data-filter]').forEach((btn) => {
        btn.setAttribute('aria-pressed', btn.dataset.filter === filter ? 'true' : 'false');
        btn.querySelector('[data-count]').textContent = String(counts[FILTERS.find((f) => f.key === btn.dataset.filter).count]);
    });

    const note = panel.querySelector('#qualiflow-console-note');
    const html = noteHtml();
    note.hidden = !html;
    if (html && note.innerHTML !== html) note.innerHTML = html;

    const events = visibleEvents();
    const list = panel.querySelector('#qualiflow-console-list');
    const wasAtBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 24;
    list.innerHTML = events.length
        ? events.map((e) => {
            const open = expanded.has(e.id);
            return `<li class="qualiflow-console-row is-${eventCategory(e)}${open ? ' is-open' : ''}" data-id="${e.id}">
                <button type="button" class="qualiflow-console-main" aria-expanded="${open ? 'true' : 'false'}">
                    <time class="qualiflow-run-mono">${fmtTime(e.t)}</time>
                    <span class="qualiflow-console-tag">${eventTag(e)}</span>
                    <span class="qualiflow-console-msg">${escapeHtml(eventSummary(e))}</span>
                </button>
                ${open ? `<pre class="qualiflow-console-detail">${escapeHtml(eventDetail(e))}</pre>` : ''}
            </li>`;
        }).join('')
        : `<li class="qualiflow-console-empty">${base.length ? 'Nenhum evento corresponde ao filtro.' : 'Nenhum erro capturado até agora.'}</li>`;
    if (follow && wasAtBottom) list.scrollTop = list.scrollHeight;

    panel.querySelector('#qualiflow-console-status').textContent = `${events.length} de ${base.length} evento(s)`;
}
