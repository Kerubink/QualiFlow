/*
 * Criterios de aceite do card pai: painel flutuante (como o HUB e o Console) para o QA consultar
 * o que esta testando sem sair da execucao. O conteudo vem do Azure como HTML e e reconstruido com
 * uma lista curta de tags permitidas (nada do HTML original e inserido como esta).
 */
import { escapeHtml } from '../dashboard/helpers.js';
import { sendRuntimeMessage } from '../shared/runtime.js';
import { RuntimeActions } from '../../../contracts/runtimeActions.js';
import { S } from './state.js';
import { setupDrag } from './helpers.js';

const PANEL_ID = 'qualiflow-criteria';
const BTN_ID = 'qualiflow-runner-criteria';
const ALLOWED = new Set(['P', 'DIV', 'BR', 'UL', 'OL', 'LI', 'B', 'STRONG', 'I', 'EM', 'U', 'H1', 'H2', 'H3', 'H4', 'BLOCKQUOTE', 'CODE', 'PRE', 'TABLE', 'TBODY', 'THEAD', 'TR', 'TD', 'TH']);
const DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META', 'NOSCRIPT']);

let cache = { workItemId: null, data: null };

export function isCriteriaOpen() {
    return !!document.getElementById(PANEL_ID);
}

function syncButton() {
    document.getElementById(BTN_ID)?.setAttribute('aria-pressed', isCriteriaOpen() ? 'true' : 'false');
}

/** Converte o HTML do Azure em HTML seguro: so tags da lista, sem atributos; o resto vira texto. */
export function sanitizeRichHtml(html) {
    if (!html || !String(html).trim()) return '';
    const doc = new DOMParser().parseFromString(String(html), 'text/html');
    const walk = (node) => {
        let out = '';
        node.childNodes.forEach((child) => {
            if (child.nodeType === 3) { out += escapeHtml(child.textContent); return; }
            if (child.nodeType !== 1) return;
            const tag = child.tagName;
            if (DROP.has(tag)) return;
            if (tag === 'BR') { out += '<br>'; return; }
            const inner = walk(child);
            out += ALLOWED.has(tag) ? `<${tag.toLowerCase()}>${inner}</${tag.toLowerCase()}>` : inner;
        });
        return out;
    };
    return walk(doc.body).trim();
}

export function toggleCriteria() {
    if (isCriteriaOpen()) closeCriteria(); else openCriteria();
}

export function closeCriteria() {
    document.getElementById(PANEL_ID)?.remove();
    syncButton();
}

function openCriteria() {
    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.className = 'qualiflow-root qualiflow-hub qualiflow-criteria';
    panel.setAttribute('role', 'complementary');
    panel.setAttribute('aria-label', 'Critérios de aceite do card');
    panel.innerHTML = `
        <div class="qualiflow-hub-head" id="qualiflow-criteria-head">
            <span class="qualiflow-hub-title">Critérios de aceite</span>
            <button type="button" class="qualiflow-close" id="qualiflow-criteria-close" aria-label="Fechar critérios" title="Fechar">&times;</button>
        </div>
        <div class="qualiflow-hub-body" id="qualiflow-criteria-body"></div>`;
    document.body.appendChild(panel);
    panel.style.left = '380px';
    panel.style.top = '72px';
    setupDrag(panel, panel.querySelector('#qualiflow-criteria-head'));
    panel.querySelector('#qualiflow-criteria-close').addEventListener('click', closeCriteria);
    panel.addEventListener('click', (e) => {
        if (e.target.closest('[data-criteria-reload]')) { cache = { workItemId: null, data: null }; load(panel); }
    });
    syncButton();
    load(panel);
}

function paint(panel, data) {
    const body = panel.querySelector('#qualiflow-criteria-body');
    if (!body) return;
    const criteria = sanitizeRichHtml(data.acceptanceCriteria);
    const description = sanitizeRichHtml(data.description);
    body.innerHTML = `
        <section class="qualiflow-hub-section">
            <div class="qualiflow-hub-section-head">
                <h3>${escapeHtml(data.type || 'Card')} #${escapeHtml(data.id)}</h3>
                <button type="button" class="qualiflow-hub-link" data-criteria-reload>Atualizar</button>
            </div>
            <div class="qualiflow-criteria-title">${escapeHtml(data.title)}</div>
        </section>
        <section class="qualiflow-hub-section">
            <h3>Critérios de aceite</h3>
            ${criteria
        ? `<div class="qualiflow-criteria-rich">${criteria}</div>`
        : '<span class="qualiflow-hub-muted">Este card não tem critérios de aceite preenchidos.</span>'}
        </section>
        ${description ? `<section class="qualiflow-hub-section"><h3>Descrição</h3><div class="qualiflow-criteria-rich">${description}</div></section>` : ''}`;
}

function load(panel) {
    const body = panel.querySelector('#qualiflow-criteria-body');
    const id = S.activeSession?.workItemId;
    if (!id) {
        body.innerHTML = '<section class="qualiflow-hub-section"><span class="qualiflow-hub-muted">Nenhuma sessão ativa. Inicie a execução a partir do Azure Boards.</span></section>';
        return;
    }
    if (cache.workItemId === id && cache.data) { paint(panel, cache.data); return; }
    body.innerHTML = '<div class="qualiflow-loading">Carregando critérios...</div>';
    sendRuntimeMessage({ action: RuntimeActions.GET_WORK_ITEM_CRITERIA, workItemId: id }, (response) => {
        if (!panel.isConnected) return;
        if (!response || response.error) {
            body.innerHTML = `<div class="qualiflow-error-box" role="alert">Erro ao carregar critérios: ${escapeHtml(response?.error || 'sem resposta')}
                <button type="button" class="qualiflow-hub-link" data-criteria-reload>Tentar de novo</button></div>`;
            return;
        }
        cache = { workItemId: id, data: response.data };
        paint(panel, response.data);
    });
}
