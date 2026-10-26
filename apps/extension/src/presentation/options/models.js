// Botoes "carregar modelos" (Gemini / Copilot).
import { normalizeCopilotModel } from '../../domain/constants.js';
import { filterAllowedCopilotModels } from '../../domain/optionsSelection.js';
import { sendRuntimeMessage, setStorage } from './messaging.js';
import { setStatusText } from './ui.js';
import { RuntimeActions } from '../../contracts/runtimeActions.js';

function renderModelOptions(selectEl, models) {
    selectEl.innerHTML = models.map(m => `<option value="${m}">${m}</option>`).join('');
}

function setupGeminiModelsButton() {
    document.getElementById('load-gemini-models-btn')?.addEventListener('click', () => {
        const keyEl = document.getElementById('gemini-key');
        const statusEl = document.getElementById('gemini-models-status');
        const selectEl = document.getElementById('gemini-model');
        if (!keyEl || !keyEl.value.trim()) {
            setStatusText(statusEl, 'Insira a API Key primeiro.', 'error');
            return;
        }
        setStatusText(statusEl, 'Carregando...', 'info');
        setStorage({ geminiKey: keyEl.value.trim() }, () => {
            sendRuntimeMessage({ action: RuntimeActions.GET_GEMINI_MODELS }, (response) => {
                if (response && response.error) {
                    setStatusText(statusEl, `Erro: ${response.error}`, 'error');
                    return;
                }
                const models = response?.models || [];
                if (!models.length) {
                    setStatusText(statusEl, 'Nenhum modelo encontrado.', 'warn');
                    return;
                }
                const currentVal = selectEl.value;
                renderModelOptions(selectEl, models);
                if (models.includes(currentVal)) selectEl.value = currentVal;
                setStatusText(statusEl, `${models.length} modelo(s) carregado(s) com sucesso!`, 'success');
            });
        });
    });
}

function setupCopilotModelsButton() {
    document.getElementById('load-copilot-models-btn')?.addEventListener('click', () => {
        const statusEl = document.getElementById('copilot-models-status');
        const selectEl = document.getElementById('copilot-model');
        setStatusText(statusEl, 'Carregando...', 'info');
        sendRuntimeMessage({ action: RuntimeActions.GET_COPILOT_MODELS }, (response) => {
            if (response && response.error) {
                setStatusText(statusEl, `Erro: ${response.error}`, 'error');
                return;
            }
            const models = response?.models || [];
            if (!models.length) {
                setStatusText(statusEl, 'Nenhum modelo encontrado.', 'warn');
                return;
            }
            const currentVal = selectEl.value;
            const allowedModels = filterAllowedCopilotModels(models);
            if (!allowedModels.length) {
                setStatusText(statusEl, 'Nenhum modelo permitido foi retornado.', 'warn');
                return;
            }

            renderModelOptions(selectEl, allowedModels);
            selectEl.value = normalizeCopilotModel(currentVal);
            setStatusText(statusEl, `${allowedModels.length} modelo(s) permitido(s) carregado(s)!`, 'success');
        });
    });
}

export function setupModelLoaders() {
    setupGeminiModelsButton();
    setupCopilotModelsButton();
}
