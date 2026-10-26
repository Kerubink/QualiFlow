import { state } from '../state.js';
import { escapeHtml, safeGetElement } from '../shared/dom.js';
import { htmlToPlainText } from '../shared/htmlToText.js';
import { buildSavedSession, removeSession, restoreSavedSession } from '../../../domain/savedSession.js';
import { shouldShowRtm } from '../../../domain/copiedScenario.js';
import { loadSavedSessions, saveSavedSessions } from '../../../infrastructure/persistence/savedSessions.js';
import { renderScenarios } from './render.js';

function hideStatus() {
    const el = safeGetElement('qualiflow-status');
    if (!el) return;
    el.style.display = 'none';
}

const esc = escapeHtml;

export function renderLocalSessions() {
    loadSavedSessions((sessions) => {
        const keys = Object.keys(sessions);
        const area = document.getElementById('qualiflow-local-sessions-area');
        if (!area) return;
        if (keys.length === 0) {
            area.style.display = 'none';
            return;
        }
        area.style.display = 'block';
        let html = `<h4 class="qualiflow-sc-local-title">Cenários Pendentes de Revisão Local:</h4>`;
        keys.forEach(id => {
            const s = sessions[id];
            const dt = new Date(s.timestamp).toLocaleString();
            const scCount = s.scenariosData ? s.scenariosData.length : 0;
            html += `
            <div class="qualiflow-acc-item qualiflow-card qualiflow-sc-local-card">
                <div class="qualiflow-sc-local-name">#${esc(s.workItem.id)} - ${esc(s.workItem.title)}</div>
                <div class="qualiflow-sc-local-meta">Salvo em: ${dt} | ${scCount} cenário(s)</div>
                <div class="qualiflow-sc-local-actions">
                    <button class="qualiflow-btn-inline qualiflow-btn-primary btn-resume-local qualiflow-sc-grow" data-id="${esc(id)}">Continuar Edição</button>
                    <button class="qualiflow-btn-inline qualiflow-btn-secondary btn-delete-local qualiflow-sc-btn-danger-outline" data-id="${esc(id)}">Excluir</button>
                </div>
            </div>
            `;
        });
        area.innerHTML = html;

        area.querySelectorAll('.btn-resume-local').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const sid = e.target.dataset.id;
                const s = sessions[sid];
                if (s) {
                    hideStatus();
                    area.style.display = 'none';
                    const restored = restoreSavedSession(s);
                    state.currentWorkItemData = restored.workItem;
                    state.currentScenarios = restored.scenarios;
                    state.currentCoverageData = restored.coverageData;
                    state.currentCopyContext = restored.copyContext;

                    const titleEl = document.getElementById('qualiflow-wi-title');
                    if (titleEl) titleEl.textContent = `#${state.currentWorkItemData.id} - ${state.currentWorkItemData.title} (Revisão Local)`;
                    const metaEl = document.getElementById('qualiflow-wi-meta');
                    if (metaEl) metaEl.textContent = `Tipo: ${state.currentWorkItemData.type} | Tags: ${state.currentWorkItemData.tags || 'Nenhuma'} `;

                    document.getElementById('qualiflow-context-area').classList.remove('qualiflow-hidden');
                    document.getElementById('qualiflow-col-scenarios').classList.remove('qualiflow-hidden');
                    document.getElementById('qualiflow-col-rtm').classList.remove('qualiflow-hidden');

                    // Pre-fill ACs
                    const acEl = document.getElementById('qualiflow-acceptance-criteria');
                    if (acEl) acEl.value = htmlToPlainText(state.currentWorkItemData.acceptance_criteria || '');

                    // restoreSavedSession ja alinha coverageData.test_cases aos cenarios restaurados
                    renderScenarios(state.currentCoverageData, { showRtm: shouldShowRtm(state.currentCopyContext) });
                }
            });
        });

        area.querySelectorAll('.btn-delete-local').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const sid = e.target.dataset.id;
                saveSavedSessions(removeSession(sessions, sid), renderLocalSessions);
            });
        });
    });
}
export function onSaveLocal() {
    if (!state.currentWorkItemData || !state.currentWorkItemData.id || !state.currentScenarios) return;
    const wiId = state.currentWorkItemData.id;
    loadSavedSessions((sessions) => {
        // buildSavedSession alinha coverageData.test_cases aos cenarios editados mais recentes
        sessions[wiId] = buildSavedSession({
            workItem: state.currentWorkItemData,
            scenarios: state.currentScenarios,
            coverageData: state.currentCoverageData,
            copyContext: state.currentCopyContext
        });
        saveSavedSessions(sessions, () => {
            const fb = document.getElementById('save-local-feedback');
            if (fb) {
                fb.classList.remove('qualiflow-hidden');
                setTimeout(() => fb.classList.add('qualiflow-hidden'), 3500);
            }
        });
    });
}
