import { state } from '../state.js';
import { escapeHtml } from '../shared/dom.js';
import { sendRuntimeMessage } from '../shared/runtime.js';
import {
    convertTestCaseToScenario,
    filterCopySourceCards
} from '../../../domain/copiedScenario.js';
import { withEditedAcceptance } from '../../../domain/scenario.js';
import { setGenerationProgress, hideGenerationProgress } from './generationProgress.js';
import { readAcceptanceCriteria, readGenerationForm } from './generationForm.js';
import { syncCopyFlowButtons } from './copyButtons.js';
import { renderScenarios } from './render.js';
import { RuntimeActions } from '../../../contracts/runtimeActions.js';

function renderCopySourceCards(cards, listEl, onSelect) {
    if (!listEl) return;
    const filtered = filterCopySourceCards(cards, state.currentWorkItemData?.id);

    if (filtered.length === 0) {
        listEl.innerHTML = '<div class="qualiflow-sc-note">Nenhum card com CTs encontrado para reaproveitamento.</div>';
        return;
    }

    listEl.innerHTML = filtered.map((card) => `
        <div class="qualiflow-card qualiflow-sc-source-card">
            <div class="qualiflow-sc-source-title">#${escapeHtml(card.id)} - ${escapeHtml(card.title)}</div>
            <div class="qualiflow-sc-source-meta">${escapeHtml(card.type || 'Item')} | ${escapeHtml(card.state || 'Sem estado')}</div>
            <button type="button" class="qualiflow-copy-source-select qualiflow-btn-inline qualiflow-btn-primary" data-id="${escapeHtml(card.id)}">Usar CTs deste card</button>
        </div>
    `).join('');

    listEl.querySelectorAll('.qualiflow-copy-source-select').forEach((btn) => {
        btn.addEventListener('click', () => {
            const cardId = Number(btn.getAttribute('data-id'));
            const selected = filtered.find((c) => Number(c.id) === cardId);
            if (selected) onSelect(selected);
        });
    });
}

export function startCopyFromCardFlow() {
    if (!state.currentWorkItemData || !state.currentWorkItemData.id) {
        alert('Abra um card alvo antes de copiar CTs de outro card.');
        return;
    }

    const overlayId = 'qualiflow-copy-source-overlay';
    const existing = document.getElementById(overlayId);
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = overlayId;
    overlay.className = 'qualiflow-root qualiflow-dialog-overlay';
    overlay.innerHTML = `
      <div class="qualiflow-dialog qualiflow-dialog-md qualiflow-dialog-surface" role="dialog" aria-modal="true" aria-labelledby="qualiflow-copy-source-title">
        <div class="qualiflow-dialog-head">
            <h3 id="qualiflow-copy-source-title" class="qualiflow-dialog-title">Reaproveitar CTs de Outro Card</h3>
            <button type="button" id="qualiflow-copy-source-close" class="qualiflow-close" aria-label="Fechar">✕</button>
        </div>
        <div class="qualiflow-sc-copy-toolbar">
            <input id="qualiflow-copy-source-search" type="text" class="qualiflow-input-edit" placeholder="Buscar por ID ou título" aria-label="Buscar por ID ou título" />
            <button type="button" id="qualiflow-copy-source-search-btn" class="qualiflow-btn-inline qualiflow-btn-primary">Buscar</button>
        </div>
        <div id="qualiflow-copy-source-list" class="qualiflow-dialog-body qualiflow-sc-copy-body" aria-live="polite">
            <div class="qualiflow-sc-note qualiflow-sc-note-italic">Carregando cards...</div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const trigger = document.activeElement;
    const close = () => {
        overlay.removeEventListener('keydown', onKeydown);
        overlay.remove();
        if (trigger && typeof trigger.focus === 'function' && document.contains(trigger)) trigger.focus();
    };
    const onKeydown = (e) => {
        if (e.key === 'Escape') close();
    };
    overlay.addEventListener('keydown', onKeydown);
    const closeBtn = document.getElementById('qualiflow-copy-source-close');
    if (closeBtn) closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close();
    });

    const listEl = document.getElementById('qualiflow-copy-source-list');
    const runSearch = (query = '') => {
        if (listEl) {
            listEl.innerHTML = '<div class="qualiflow-sc-note qualiflow-sc-note-italic">Buscando cards com CTs...</div>';
        }

        sendRuntimeMessage({ action: RuntimeActions.GET_TEST_RUNNER_CARDS, query }, (response) => {
            if (!response || response.error) {
                if (listEl) listEl.innerHTML = `<div class="qualiflow-sc-note qualiflow-sc-note-error" role="alert">Erro ao buscar cards: ${escapeHtml(response?.error || 'desconhecido')}</div>`;
                return;
            }

            renderCopySourceCards(response.data || [], listEl, (sourceCard) => {
                if (listEl) {
                    listEl.innerHTML = '<div class="qualiflow-sc-note qualiflow-sc-note-italic">Carregando CTs do card selecionado...</div>';
                }

                sendRuntimeMessage({ action: RuntimeActions.GET_TEST_CASES_FOR_WORKITEM, workItemId: sourceCard.id }, (tcResponse) => {
                    if (!tcResponse || tcResponse.error) {
                        if (listEl) listEl.innerHTML = `<div class="qualiflow-sc-note qualiflow-sc-note-error" role="alert">Erro ao buscar CTs: ${escapeHtml(tcResponse?.error || 'desconhecido')}</div>`;
                        return;
                    }

                    const sourceCases = Array.isArray(tcResponse.data) ? tcResponse.data : [];
                    if (sourceCases.length === 0) {
                        if (listEl) listEl.innerHTML = '<div class="qualiflow-sc-note qualiflow-sc-note-warning">O card selecionado não possui CTs vinculados.</div>';
                        return;
                    }

                    state.currentCopyContext = {
                        mode: 'manual',
                        sourceWorkItemId: sourceCard.id,
                        sourceWorkItemTitle: sourceCard.title,
                        copiedAt: Date.now()
                    };

                    const copiedScenarios = sourceCases.map((tc) => convertTestCaseToScenario(tc, sourceCard));
                    renderScenarios({ test_cases: copiedScenarios }, { showRtm: false, mode: 'copy-manual' });
                    close();
                });
            });
        });
    };

    const searchBtn = document.getElementById('qualiflow-copy-source-search-btn');
    const searchEl = document.getElementById('qualiflow-copy-source-search');
    if (searchBtn) searchBtn.addEventListener('click', () => runSearch(searchEl?.value?.trim() || ''));
    if (searchEl) {
        searchEl.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') runSearch(searchEl.value.trim());
        });
    }

    runSearch('');
    if (searchEl) searchEl.focus();
}

export function onAutoAdjustCopiedScenarios() {
    if (!state.currentWorkItemData || !state.currentWorkItemData.id) {
        alert('Abra o card alvo antes de rodar ajustes automáticos.');
        return;
    }

    if (!state.currentCopyContext || state.currentCopyContext.mode !== 'manual') {
        alert('Primeiro copie CTs de outro card para habilitar os ajustes automáticos.');
        return;
    }

    if (!Array.isArray(state.currentScenarios) || state.currentScenarios.length === 0) {
        alert('Não há CTs copiados para ajustar.');
        return;
    }

    const adjustBtn = document.getElementById('btn-copy-auto-adjust');
    if (adjustBtn) {
        adjustBtn.disabled = true;
        adjustBtn.textContent = 'Ajustando...';
    }

    setGenerationProgress('start', 'Analisando CTs copiados e critérios do card alvo...');
    const layoutEl = document.getElementById('qualiflow-generation-layout');
    if (layoutEl) layoutEl.classList.add('qualiflow-loading-active');

    const editedAcceptance = readAcceptanceCriteria();
    const { userFocus, technicalDetail, generationSettings } = readGenerationForm();

    sendRuntimeMessage({
        action: RuntimeActions.ADAPT_COPIED_SCENARIOS,
        targetCardData: withEditedAcceptance(state.currentWorkItemData, editedAcceptance),
        copiedScenarios: state.currentScenarios,
        copyContext: state.currentCopyContext,
        userFocus,
        technicalDetail,
        generationSettings
    }, (response) => {
        if (adjustBtn) {
            adjustBtn.disabled = false;
            adjustBtn.innerHTML = '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" class="qualiflow-sc-icon-inline"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"></path></svg> Ajustes Automáticos';
        }

        if (!response || response.error) {
            setGenerationProgress('error', `Erro no ajuste: ${response?.error || 'desconhecido'}`);
            hideGenerationProgress();
            alert(`Erro ao ajustar CTs copiados: ${response?.error || 'desconhecido'}`);
            return;
        }

        state.currentCopyContext = {
            ...state.currentCopyContext,
            mode: 'adapted',
            adjustedAt: Date.now()
        };

        syncCopyFlowButtons();
        renderScenarios(response.scenarios || [], { showRtm: true, mode: 'copy-adjusted' });
        setGenerationProgress('done', 'Ajustes automáticos concluídos com RTM atualizado.');
    });
}
