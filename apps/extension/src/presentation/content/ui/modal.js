import { hooks } from '../hooks.js';
import { MODAL_HTML } from './modalMarkup.js';
import { closeModal } from './closeModal.js';
import { loadRunnerCards } from './runnerCards.js';

export function injectModal() {
    if (document.getElementById('qualiflow-modal-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'qualiflow-modal-overlay';
    overlay.className = 'qualiflow-hidden qualiflow-root';

    const modal = document.createElement('div');
    modal.id = 'qualiflow-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'qualiflow-modal-title');

    modal.innerHTML = MODAL_HTML;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const editOverlay = document.createElement('div');
    editOverlay.id = 'qualiflow-edit-modal-overlay';
    editOverlay.className = 'qualiflow-hidden qualiflow-root';
    editOverlay.innerHTML = `
        <div id="qualiflow-edit-modal" role="dialog" aria-modal="true" aria-labelledby="qualiflow-edit-modal-title">
            <div class="qualiflow-header">
                <h2 id="qualiflow-edit-modal-title">✏️ Editar Cenário</h2>
                <button type="button" class="qualiflow-close" id="qualiflow-edit-close" aria-label="Fechar">&times;</button>
            </div>
            <div class="qualiflow-edit-modal-body" id="qualiflow-edit-body"></div>
            <div class="qualiflow-edit-modal-footer">
                <button type="button" id="qualiflow-edit-cancel" class="qualiflow-btn-inline qualiflow-btn-secondary">Cancelar</button>
                <button type="button" id="qualiflow-edit-save" class="qualiflow-btn-inline qualiflow-btn-primary">Salvar Edições</button>
            </div>
        </div>
    `;
    document.body.appendChild(editOverlay);

    const testModalOverlay = document.createElement('div');
    testModalOverlay.id = 'qualiflow-tests-modal-overlay';
    testModalOverlay.className = 'qualiflow-hidden qualiflow-root';
    testModalOverlay.innerHTML = `
        <div id="qualiflow-tests-modal" role="dialog" aria-modal="true" aria-labelledby="tests-modal-title">
            <div class="qualiflow-header">
                <h2 id="tests-modal-title">Casos de Teste do PBI</h2>
                <button type="button" class="qualiflow-close" id="qualiflow-tests-close" aria-label="Fechar">&times;</button>
            </div>
            <div class="qualiflow-edit-modal-body" id="qualiflow-tests-body"></div>
        </div>
    `;
    document.body.appendChild(testModalOverlay);

    document.getElementById('qualiflow-close').addEventListener('click', closeModal);
    document.getElementById('qualiflow-edit-close').addEventListener('click', (e) => hooks.closeEditModal(e));
    document.getElementById('qualiflow-edit-cancel').addEventListener('click', (e) => hooks.closeEditModal(e));
    document.getElementById('qualiflow-tests-close').addEventListener('click', () => {
        document.getElementById('qualiflow-tests-modal-overlay').classList.add('qualiflow-hidden');
    });
    document.getElementById('btn-generate').addEventListener('click', (e) => hooks.onGenerateScenarios(e));
    document.getElementById('btn-copy-from-card')?.addEventListener('click', () => {
        if (typeof hooks.startCopyFromCardFlow === 'function') {
            hooks.startCopyFromCardFlow();
        }
    });
    document.getElementById('btn-copy-auto-adjust')?.addEventListener('click', () => {
        if (typeof hooks.onAutoAdjustCopiedScenarios === 'function') {
            hooks.onAutoAdjustCopiedScenarios();
        }
    });
    document.getElementById('btn-eval').addEventListener('click', (e) => hooks.onEvaluateCoverage(e));
    document.getElementById('btn-save').addEventListener('click', (e) => hooks.onSaveScenarios(e));
    document.getElementById('btn-save-local').addEventListener('click', (e) => hooks.onSaveLocal(e));
    document.getElementById('qualiflow-runner-search-btn')?.addEventListener('click', () => {
        const searchEl = document.getElementById('qualiflow-runner-search');
        loadRunnerCards(searchEl ? searchEl.value.trim() : '');
    });
    document.getElementById('qualiflow-runner-search')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') loadRunnerCards(e.target.value.trim());
    });

    bindEscapeToClose();
}

let escapeBound = false;

// Esc fecha o overlay mais alto aberto (tests > edit > drawer principal).
function bindEscapeToClose() {
    if (escapeBound) return;
    escapeBound = true;
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        const isOpen = (id) => {
            const el = document.getElementById(id);
            return !!el && !el.classList.contains('qualiflow-hidden');
        };
        if (isOpen('qualiflow-tests-modal-overlay')) {
            document.getElementById('qualiflow-tests-modal-overlay').classList.add('qualiflow-hidden');
        } else if (isOpen('qualiflow-edit-modal-overlay')) {
            hooks.closeEditModal(e);
        } else if (isOpen('qualiflow-modal-overlay')
            && document.getElementById('qualiflow-modal-overlay').classList.contains('qualiflow-open')) {
            closeModal();
        } else {
            return;
        }
        e.stopPropagation();
    }, true);
}
