/*
 * Atalhos de teclado do runner (so com uma execucao em andamento). Usam Alt + tecla fisica (e.code),
 * para nao colidir com a digitacao nem com atalhos do sistema testado, e funcionam em qualquer layout.
 */
import { S } from './state.js';
import { isPaused } from './timers.js';
import { captureBrowserTab, captureDisplay } from './captureSources.js';
import { annotateAndAttachEvidence } from './evidenceFlow.js';
import { currentStepTarget, markCurrentStep, openCurrentStepEvidence, saveCurrentCt, togglePause } from './executionView.js';
import { toggleHub } from './hub.js';
import { toggleConsole } from './consolePanel.js';
import { toggleUiToolbar } from './uiToolbar.js';
import { showQualiFlowUiAfterCapture } from './screenCapture.js';
import { showToast } from './toast.js';

export const SHORTCUTS = [
    { keys: 'Alt + 1', label: 'Aprovar o passo atual' },
    { keys: 'Alt + 2', label: 'Reprovar o passo atual' },
    { keys: 'Alt + P', label: 'Pausar / retomar o teste' },
    { keys: 'Alt + E', label: 'Abrir evidências do passo atual' },
    { keys: 'Alt + Shift + S', label: 'Captura rápida da aba, anexada ao passo atual' },
    { keys: 'Alt + Shift + D', label: 'Capturar tela ou janela e anexar ao passo atual' },
    { keys: 'Alt + Shift + Enter', label: 'Salvar o CT e avançar' },
    { keys: 'Alt + H', label: 'Abrir / fechar o HUB' },
    { keys: 'Alt + J', label: 'Abrir / fechar o Console' },
    { keys: 'Alt + U', label: 'Abrir / fechar as ferramentas de UI/UX' }
];

let wired = false;

function runActive() {
    const st = S.runnerState;
    return !!(st && st.runId && st.currentTcIndex < st.testCases.length);
}

async function quickCapture(source) {
    const target = currentStepTarget() || (() => {
        const st = S.runnerState;
        const tc = st.testCases[st.currentTcIndex];
        return { tc, idx: null };
    })();
    try {
        const dataUrl = await (source === 'tab' ? captureBrowserTab() : captureDisplay());
        annotateAndAttachEvidence(target.tc, target.idx, dataUrl, source === 'tab' ? 'aba' : 'captura');
    } catch (err) {
        showQualiFlowUiAfterCapture();
        if (!err?.cancelled) showToast(err?.message || 'Falha na captura.', { kind: 'error' });
    }
}

function onKeydown(e) {
    if (!e.altKey || e.ctrlKey || e.metaKey || !runActive()) return;
    if (document.getElementById('qualiflow-annotation-panel')) return;
    const modalOpen = !!document.getElementById('qualiflow-evidence-overlay') || !!document.getElementById('qualiflow-bug-dialog');

    let handled = false;
    if (e.shiftKey) {
        if (modalOpen || isPaused()) return;
        if (e.code === 'KeyS') { quickCapture('tab'); handled = true; }
        else if (e.code === 'KeyD') { quickCapture('display'); handled = true; }
        else if (e.code === 'Enter') { saveCurrentCt(); handled = true; }
    } else if (e.code === 'KeyP') {
        if (!modalOpen) { togglePause(); handled = true; }
    } else if (e.code === 'KeyH') {
        toggleHub();
        handled = true;
    } else if (e.code === 'KeyU') {
        toggleUiToolbar();
        handled = true;
    } else if (e.code === 'KeyJ') {
        toggleConsole();
        handled = true;
    } else if (!modalOpen && !isPaused()) {
        if (e.code === 'Digit1') handled = markCurrentStep('Passed');
        else if (e.code === 'Digit2') handled = markCurrentStep('Failed');
        else if (e.code === 'KeyE') handled = openCurrentStepEvidence();
    }
    if (handled) {
        e.preventDefault();
        e.stopPropagation();
    }
}

export function initShortcuts() {
    if (wired) return;
    wired = true;
    document.addEventListener('keydown', onKeydown, true);
}
