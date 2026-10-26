import { TabMessages } from '../../../contracts/runtimeActions.js';

const generationProgressState = {
    visible: false,
    currentStage: 'idle',
    batchLabel: ''
};

function ensureGenerationProgressUI() {
    const layoutEl = document.getElementById('qualiflow-generation-layout');
    if (!layoutEl) return null;

    let box = document.getElementById('qualiflow-generation-progress');
    if (!box) {
        box = document.createElement('div');
        box.id = 'qualiflow-generation-progress';
        box.className = 'qualiflow-gen-progress-overlay qualiflow-hidden';
        box.setAttribute('role', 'status');
        box.setAttribute('aria-live', 'polite');
        box.innerHTML = `
            <div class="qualiflow-gen-progress-shell">
                <div class="qualiflow-gen-progress-head">
                    <span class="qualiflow-gen-spinner"></span>
                    <span id="qualiflow-gen-main-label">Preparando geracao...</span>
                </div>
                <div class="qualiflow-gen-steps">
                    <div class="qualiflow-gen-step" data-stage="analyzing">Analisando regras e criterios...</div>
                    <div class="qualiflow-gen-step" data-stage="batch">Gerando cenarios de teste...</div>
                    <div class="qualiflow-gen-step" data-stage="rtm">Montando matriz RTM e cobertura...</div>
                    <div class="qualiflow-gen-step" data-stage="postprocess">Consolidando resultado final...</div>
                </div>
                <div id="qualiflow-gen-batch-label" class="qualiflow-gen-batch-label"></div>
            </div>
        `;
        layoutEl.appendChild(box);
    }

    return box;
}

export function setGenerationProgress(stage, message, meta = {}) {
    const box = ensureGenerationProgressUI();
    if (!box) return;

    const mainLabel = document.getElementById('qualiflow-gen-main-label');
    const batchLabel = document.getElementById('qualiflow-gen-batch-label');
    if (mainLabel && message) mainLabel.textContent = message;

    const stageMap = {
        start: 'analyzing',
        analyzing: 'analyzing',
        'batch-start': 'batch',
        'batch-progress': 'batch',
        rtm: 'rtm',
        postprocess: 'postprocess',
        fallback: 'batch',
        done: 'done',
        error: 'error'
    };

    const mapped = stageMap[stage] || 'analyzing';
    generationProgressState.currentStage = mapped;
    generationProgressState.visible = true;

    box.classList.remove('qualiflow-hidden');

    const order = ['analyzing', 'batch', 'rtm', 'postprocess'];
    const activeIndex = order.indexOf(mapped);
    box.querySelectorAll('.qualiflow-gen-step').forEach((stepEl, idx) => {
        stepEl.classList.remove('is-active', 'is-done');
        if (mapped !== 'error' && mapped !== 'done' && idx < activeIndex) stepEl.classList.add('is-done');
        if (mapped !== 'error' && mapped !== 'done' && idx === activeIndex) stepEl.classList.add('is-active');
        if (mapped === 'done') stepEl.classList.add('is-done');
    });

    if (batchLabel) {
        const hasBatch = Number(meta.batchIndex) > 0 && Number(meta.totalBatches) > 0;
        batchLabel.textContent = hasBatch
            ? `Lote ${meta.batchIndex} de ${meta.totalBatches}`
            : '';
    }

    if (mapped === 'done') {
        setTimeout(() => hideGenerationProgress(), 1400);
    }
}

export function hideGenerationProgress() {
    const box = document.getElementById('qualiflow-generation-progress');
    if (!box) return;
    box.classList.add('qualiflow-hidden');
    const layoutEl = document.getElementById('qualiflow-generation-layout');
    if (layoutEl) layoutEl.classList.remove('qualiflow-loading-active');
    generationProgressState.visible = false;
    generationProgressState.currentStage = 'idle';
}

// Escuta o progresso emitido pelo background durante geracao/adaptacao (registrado uma unica vez).
export function attachGenerationProgressListener() {
    if (window.__qualiflowGenerationProgressListenerAttached) return;
    window.__qualiflowGenerationProgressListenerAttached = true;
    chrome.runtime.onMessage.addListener((message) => {
        if (message?.action !== TabMessages.GENERATION_PROGRESS) return;
        setGenerationProgress(message.stage, message.message, message);
    });
}
