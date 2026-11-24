/* Fluxo unico: imagem capturada -> editor de anotacoes -> upload como evidencia do CT/passo. */
import { S } from './state.js';
import { openAnnotationPanel } from './annotationPanel.js';
import { addAndUploadEvidence, buildEvidenceFileName, getEvidenceKey } from './evidenceUpload.js';
import { showQualiFlowUiAfterCapture } from './screenCapture.js';

export function watermarkTextFor(tc, stepIdx) {
    const step = stepIdx !== null && stepIdx !== undefined ? ` passo ${tc.steps[stepIdx]?.order ?? stepIdx + 1}` : '';
    return `CT #${tc.id}${step} | ${new Date().toLocaleString('pt-BR')} | ${location.href}`;
}

export function annotateAndAttachEvidence(tc, stepIdx, dataUrl, kind) {
    openAnnotationPanel(dataUrl, async (annotated) => {
        showQualiFlowUiAfterCapture();
        if (!annotated) return;
        const key = getEvidenceKey(tc, stepIdx);
        if (!S.runnerState.evidences[key]) S.runnerState.evidences[key] = [];
        await addAndUploadEvidence(tc, stepIdx, S.runnerState.evidences[key], key, {
            name: buildEvidenceFileName(tc, stepIdx, kind, 'png'),
            dataUrl: annotated,
            type: 'image/png',
            status: 'pending'
        });
    }, { watermarkText: watermarkTextFor(tc, stepIdx) });
}
