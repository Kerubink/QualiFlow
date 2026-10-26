import { state } from '../state.js';
import { sendRuntimeMessage } from '../shared/runtime.js';
import { withEditedAcceptance } from '../../../domain/scenario.js';
import { setGenerationProgress, hideGenerationProgress } from './generationProgress.js';
import { readAcceptanceCriteria, readGenerationForm } from './generationForm.js';
import { syncCopyFlowButtons } from './copyButtons.js';
import { renderScenarios } from './render.js';
import { RuntimeActions } from '../../../contracts/runtimeActions.js';

export function onGenerateScenarios() {
    const btn = document.getElementById('btn-generate');
    btn.disabled = true;
    btn.textContent = 'Gerando (aguarde)...';

    const { userFocus, technicalDetail, generationSettings } = readGenerationForm();
    const editedAcceptance = readAcceptanceCriteria();

    setGenerationProgress('start', 'Preparando analise da historia...');
    const layoutEl = document.getElementById('qualiflow-generation-layout');
    if (layoutEl) layoutEl.classList.add('qualiflow-loading-active');

    document.getElementById('qualiflow-col-scenarios').classList.remove('qualiflow-hidden');
    document.getElementById('qualiflow-col-rtm').classList.remove('qualiflow-hidden');

    sendRuntimeMessage({
        action: RuntimeActions.GENERATE_SCENARIOS,
        cardData: withEditedAcceptance(state.currentWorkItemData, editedAcceptance),
        userFocus,
        technicalDetail,
        generationSettings
    }, (response) => {
        btn.disabled = false;
        btn.textContent = 'Gerar Novamente';

        if (response && response.error) {
            setGenerationProgress('error', `Erro na geracao: ${response.error}`);
            hideGenerationProgress();
            alert("Erro na geração: " + response.error);
            return;
        }

        state.currentCopyContext = null;
        syncCopyFlowButtons();
        state.currentScenarios = response?.scenarios || [];
        renderScenarios(state.currentScenarios, { showRtm: true });
        setGenerationProgress('done', 'Cenarios finalizados com sucesso.');
    });
}
