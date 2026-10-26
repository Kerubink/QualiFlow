import { sendRuntimeMessage } from '../shared/runtime.js';
import { hooks } from '../hooks.js';
import { state } from '../state.js';
import { safeGetElement } from '../shared/dom.js';
import { htmlToPlainText } from '../shared/htmlToText.js';
import { detectBoardProvider, extractWorkItemId } from '../shared/pageContext.js';
import { uiState } from './uiState.js';
import { showStatus, hideStatus } from './status.js';
import { injectModal } from './modal.js';
import { loadSettingsToUI } from './settings.js';
import { loadRunnerCards } from './runnerCards.js';
import { RuntimeActions } from '../../../contracts/runtimeActions.js';

function hideSection(id) {
    const el = safeGetElement(id);
    if (!el) return;
    el.classList.add('qualiflow-hidden');
}
function showSection(id) {
    const el = safeGetElement(id);
    if (!el) return;
    el.classList.remove('qualiflow-hidden');
}
let railBound = false;

function syncRail(page) {
    const active = page === 'dashboard' || page === 'runner' || page === 'settings' ? page : 'generator';
    document.querySelectorAll('#qualiflow-modal [data-qf-nav]').forEach((btn) => {
        const isActive = btn.dataset.qfNav === active;
        btn.classList.toggle('is-active', isActive);
        if (isActive) btn.setAttribute('aria-current', 'page');
        else btn.removeAttribute('aria-current');
    });
}

function bindRail() {
    if (railBound) return;
    const modal = safeGetElement('qualiflow-modal');
    if (!modal) return;
    railBound = true;
    const isAzure = detectBoardProvider() === 'azure';
    modal.querySelectorAll('[data-qf-azure-only]').forEach((btn) => {
        if (!isAzure) btn.classList.add('qualiflow-hidden');
    });
    modal.querySelectorAll('[data-qf-nav]').forEach((btn) => {
        btn.addEventListener('click', () => openModal(btn.dataset.qfNav));
    });
}

export function openModal(page = 'generator') {
    const active = document.activeElement;
    uiState.modalTrigger = active && active !== document.body ? active : null;
    injectModal();
    bindRail();
    syncRail(page);

    const pageGeneratorEl = safeGetElement('qualiflow-page-generator');
    const pageRunnerEl = safeGetElement('qualiflow-page-runner');
    const pageSettingsEl = safeGetElement('qualiflow-page-settings');
    const overlay = safeGetElement('qualiflow-modal-overlay');
    const modalHeader = safeGetElement('qualiflow-modal')?.querySelector('h2');

    if (page === 'dashboard' || page === 'generator') {
        if (pageGeneratorEl) pageGeneratorEl.classList.remove('qualiflow-hidden');
        if (pageRunnerEl) pageRunnerEl.classList.add('qualiflow-hidden');
        if (pageSettingsEl) pageSettingsEl.classList.add('qualiflow-hidden');
        if (page === 'dashboard') {
            if (modalHeader) modalHeader.innerHTML = `<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M3 3v18h18M18 17V9M13 17V5M8 17v-3"></path></svg> QualiFlow - Dashboard QA`;
        } else {
            if (modalHeader) modalHeader.innerHTML = `<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg> QualiFlow - Gerador de Casos de Teste`;
        }
    } else if (page === 'runner') {
        if (pageGeneratorEl) pageGeneratorEl.classList.add('qualiflow-hidden');
        if (pageRunnerEl) pageRunnerEl.classList.remove('qualiflow-hidden');
        if (pageSettingsEl) pageSettingsEl.classList.add('qualiflow-hidden');
        if (modalHeader) modalHeader.innerHTML = `<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347c-.75.412-1.667-.13-1.667-.986V5.653z"></path></svg> QualiFlow - Test Runner`;
    } else {
        if (pageGeneratorEl) pageGeneratorEl.classList.add('qualiflow-hidden');
        if (pageRunnerEl) pageRunnerEl.classList.add('qualiflow-hidden');
        if (pageSettingsEl) pageSettingsEl.classList.remove('qualiflow-hidden');
        if (modalHeader) modalHeader.innerHTML = `⚙️ QualiFlow - Configurações`;
        loadSettingsToUI();
    }

    if (overlay) {
        overlay.classList.remove('qualiflow-hidden');
        setTimeout(() => {
            overlay.classList.add('qualiflow-open');
        }, 10);
    }

    if (page === 'settings') return;

    if (page === 'runner') {
        loadRunnerCards('');
        return;
    }

    const layoutEl = document.getElementById('qualiflow-generation-layout');
    const dashEl = document.getElementById('qualiflow-dashboard-container');
    const localSessArea = document.getElementById('qualiflow-local-sessions-area');
    if (localSessArea) localSessArea.style.display = 'none';

    if (page === 'dashboard') {
        if (layoutEl) layoutEl.style.display = 'none';
        if (dashEl) dashEl.classList.remove('qualiflow-hidden');

        // Habilita navegacao das abas imediatamente, mesmo antes da resposta async.
        hooks.initDashboardTabs();

        const renderDashboardWithData = (rawData, sourceLabel, meta = null) => {
            const list = Array.isArray(rawData)
                ? rawData
                : (Array.isArray(rawData?.items) ? rawData.items : []);
            const normalized = list.map((item) => ({
                id: item.id,
                title: item.title || `Sem título (${item.id || 'N/A'})`,
                type: item.type || '',
                state: item.state || '',
                tags: item.tags || '',
                iterationPath: item.iterationPath || 'Desconhecido',
                url: item.url || '#',
                testCases: Array.isArray(item.testCases) ? item.testCases : []
            }));

            hideStatus();
            hooks.renderDashboard(normalized);

            const resolvedMeta = meta || rawData?.meta || null;
            const metaText = resolvedMeta
                ? ` | pais: ${resolvedMeta.parentCardsLoaded ?? '-'}, testes vinculados: ${resolvedMeta.linkedTestsLoaded ?? '-'}, testes standalone: ${resolvedMeta.standaloneTestsLoaded ?? '-'}`
                : '';
            showStatus(`Dashboard carregado com ${normalized.length} item(ns) [fonte: ${sourceLabel}]${metaText}.`, false);

            state.dashboardMeta = resolvedMeta || null;
        };

        const loadDashboardFallback = () => {
            sendRuntimeMessage({ action: RuntimeActions.GET_TEST_RUNNER_CARDS, query: '' }, (fallbackResponse) => {
                if (fallbackResponse?.error) {
                    showStatus(`Erro ao carregar fallback do dashboard: ${fallbackResponse.error}`, true);
                    hooks.renderDashboard([]);
                    return;
                }
                renderDashboardWithData(fallbackResponse?.data || [], 'runner-fallback', null);
            });
        };

        showStatus('Buscando cards do board para o dashboard geral...', false);
        sendRuntimeMessage({ action: RuntimeActions.GET_DASHBOARD_DATA }, (response) => {
            if (!response) {
                showStatus('Sem resposta do serviço principal. Usando fallback...', true);
                loadDashboardFallback();
                return;
            }

            if (response.error) {
                showStatus(`Aviso: ${response.error}. Usando fallback...`, true);
                loadDashboardFallback();
                return;
            }

            try {
                const mainPayload = response.data;
                const mainData = Array.isArray(mainPayload)
                    ? mainPayload
                    : (Array.isArray(mainPayload?.items) ? mainPayload.items : []);
                if (mainData.length === 0) {
                    showStatus('Fonte principal retornou 0 itens. Usando fallback...', true);
                    loadDashboardFallback();
                    return;
                }

                renderDashboardWithData(mainPayload, 'principal', mainPayload?.meta || null);

                setTimeout(() => {
                    hooks.initDashboardTabs();
                }, 100);
            } catch (err) {
                console.error('[QualiFlow] Erro ao abrir dashboard:', err);
                showStatus(`Erro ao renderizar dashboard principal: ${err?.message || 'falha desconhecida'}. Usando fallback...`, true);
                loadDashboardFallback();
            }
        });
        return;
    }

    // Otherwise, we are in 'generator' mode
    if (layoutEl) layoutEl.style.display = 'flex';
    if (dashEl) dashEl.classList.add('qualiflow-hidden');

    // Hide context area and RTM/scenarios by default when re-opening modal
    hideSection('qualiflow-context-area');
    hideSection('qualiflow-col-rtm');
    hideSection('qualiflow-col-scenarios');

    const wiId = extractWorkItemId();
    if (!wiId) {
        showStatus('Erro: Você deve abrir um PBI ou Bug no Azure Boards primeiro.', true);
        hooks.renderLocalSessions();
        return;
    }

    showStatus(`Buscando dados do Work Item ${wiId}...`);
    sendRuntimeMessage({ action: RuntimeActions.GET_DATA, workId: wiId, provider: detectBoardProvider() }, (response) => {
        if (response && response.error) {
            showStatus(`Erro: ${response.error} `, true);
            return;
        }

        hideStatus();
        state.currentWorkItemData = response.data;
        state.currentCopyContext = null;
        if (typeof hooks.syncCopyFlowButtons === 'function') {
            hooks.syncCopyFlowButtons();
        }

        const titleEl = safeGetElement('qualiflow-wi-title');
        if (titleEl) titleEl.textContent = `${state.currentWorkItemData.title} (#${state.currentWorkItemData.id})`;
        const metaEl = safeGetElement('qualiflow-wi-meta');
        if (metaEl) metaEl.textContent = `Tipo: ${state.currentWorkItemData.type} | Tags: ${state.currentWorkItemData.tags || 'Nenhuma'} `;

        showSection('qualiflow-context-area');

        // Prefill editable acceptance criteria in the UI (sanitized from HTML)
        const acEl = document.getElementById('qualiflow-acceptance-criteria');
        if (acEl) acEl.value = htmlToPlainText(state.currentWorkItemData.acceptance_criteria || '');

        if (state.currentWorkItemData.existing_tests && state.currentWorkItemData.existing_tests.length > 0) {
            document.getElementById('qualiflow-eval-container').classList.remove('qualiflow-hidden');
        } else {
            document.getElementById('qualiflow-eval-container').classList.add('qualiflow-hidden');
        }
    });
}
