import { state } from '../state.js';
import { sendRuntimeMessage } from '../shared/runtime.js';
import { RuntimeActions } from '../../../contracts/runtimeActions.js';

export function onEvaluateCoverage() {
    const btn = document.getElementById('btn-eval');
    btn.disabled = true;
    btn.textContent = 'Avaliando...';
    const resDiv = document.getElementById('qualiflow-eval-result');
    resDiv.classList.add('qualiflow-hidden');

    sendRuntimeMessage({ action: RuntimeActions.EVALUATE_COVERAGE, cardData: state.currentWorkItemData }, (response) => {
        btn.disabled = false;
        btn.textContent = '🔍 Avaliar Cobertura Atual';
        if (response && response.error) {
            resDiv.textContent = `Erro: ${response.error} `;
            resDiv.classList.remove('qualiflow-hidden');
            resDiv.className = 'qualiflow-eval-result error';
        } else {
            resDiv.textContent = response?.result || '';
            resDiv.classList.remove('qualiflow-hidden');
            resDiv.className = 'qualiflow-eval-result';
        }
    });
}
