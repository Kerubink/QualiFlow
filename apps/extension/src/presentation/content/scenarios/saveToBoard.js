import { state } from '../state.js';
import { sendRuntimeMessage } from '../shared/runtime.js';
import { detectBoardProvider } from '../shared/pageContext.js';
import { prepareScenarioForSave, stripExistingTests } from '../../../domain/scenario.js';
import { buildSaveErrorMessage, countSuccesses } from '../../../domain/saveResult.js';
import { removeSession } from '../../../domain/savedSession.js';
import { loadSavedSessions, saveSavedSessions } from '../../../infrastructure/persistence/savedSessions.js';
import { hooks } from '../hooks.js';
import { RuntimeActions } from '../../../contracts/runtimeActions.js';

export function onSaveScenarios() {
    const selectedIndices = Array.from(document.querySelectorAll('.scenario-check:checked')).map(el => parseInt(el.dataset.idx));

    if (selectedIndices.length === 0) {
        alert("Nenhum cenário selecionado.");
        return;
    }

    const finalScenarios = selectedIndices.map(idx => {
        return prepareScenarioForSave(state.currentScenarios[idx]);
    });
    const btn = document.getElementById('btn-save');
    const provider = detectBoardProvider();
    const providerLabel = provider === 'jira' ? 'Jira' : 'Azure';
    btn.disabled = true;
    btn.textContent = `Salvando no ${providerLabel}...`;

    // Strip existing_tests (large XML payloads) from parentData — not needed for save
    const parentDataClean = stripExistingTests(state.currentWorkItemData);

    sendRuntimeMessage({ action: RuntimeActions.SAVE_SCENARIOS, scenarios: finalScenarios, parentData: parentDataClean, provider }, (response) => {
        btn.disabled = false;
        btn.textContent = 'Salvar no Board';

        if (!response || response.error || !response.success) {
            const errorMsg = buildSaveErrorMessage(response);

            alert(errorMsg);
        } else {
            loadSavedSessions((sessions) => {
                if (state.currentWorkItemData && sessions[state.currentWorkItemData.id]) {
                    saveSavedSessions(removeSession(sessions, state.currentWorkItemData.id));
                }
            });

            const successCount = countSuccesses(response.results);
            alert(`✅ Sucesso! ${successCount} teste(s) criado(s) no ${providerLabel}.\n\nAtualizando página...`);
            if (typeof hooks.closeModal === 'function') hooks.closeModal();
            window.location.reload();
        }
    });
}
