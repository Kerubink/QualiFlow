import { sendRuntimeMessage } from '../shared/runtime.js';
import { S } from './state.js';
import { refreshEvidenceIndicators } from './evidenceIndicators.js';
import { renderEvidenceList } from './evidencePanel.js';
import { RuntimeActions } from '../../../contracts/runtimeActions.js';
import { logEvent } from './runLog.js';

export function getEvidenceKey(tc, stepIdx) {
    return stepIdx !== null && stepIdx !== undefined ? `${tc.id}_step_${stepIdx}` : String(tc.id);
}

function getResultMetaForTc(tc) {
    if (!S.runnerState?.results) return null;
    return S.runnerState.results.find(r => Number(r.testCaseId) === Number(tc.id)) || null;
}

export function buildEvidenceFileName(tc, stepIdx, kind, ext) {
    const stepPart = stepIdx !== null && stepIdx !== undefined
        ? `_passo${tc.steps[stepIdx]?.order ?? (stepIdx + 1)}`
        : '';
    return `ct${tc.id}${stepPart}_${kind}_${Date.now()}.${ext}`;
}

function dataUrlToBase64(dataUrl) {
    if (!dataUrl) return '';
    const comma = dataUrl.indexOf(',');
    return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(dataUrlToBase64(reader.result));
        reader.onerror = () => reject(reader.error || new Error('Falha ao ler blob'));
        reader.readAsDataURL(blob);
    });
}

/**
 * Upload evidence as Test Result attachment in Azure (execution-scoped).
 * Step-level evidence is tagged in the attachment comment (Azure attaches to result, not step).
 */
export async function uploadEvidenceToAzure(tc, stepIdx, evidence) {
    const meta = getResultMetaForTc(tc);
    if (!meta?.resultId) {
        return { error: `Não foi possível correlacionar o CT #${tc.id} com o resultado da execução no Azure.`, local: true };
    }
    if (!S.runnerState?.runId) {
        return { error: 'Sessão sem Test Run ativo.', local: true };
    }

    let base64Content;
    try {
        if (evidence.blob) {
            base64Content = await blobToBase64(evidence.blob);
        } else {
            base64Content = dataUrlToBase64(evidence.dataUrl);
        }
    } catch (err) {
        return { error: 'Falha ao preparar arquivo: ' + (err.message || err), local: true };
    }

    if (!base64Content) return { error: 'Arquivo de evidência vazio.', local: true };

    const stepLabel = stepIdx !== null && stepIdx !== undefined
        ? `Passo ${tc.steps[stepIdx]?.order ?? (stepIdx + 1)}`
        : null;
    const comment = stepLabel
        ? `Evidência do ${stepLabel} — CT #${tc.id}`
        : `Evidência do CT #${tc.id}`;

    return new Promise((resolve) => {
        sendRuntimeMessage({
            action: RuntimeActions.ADD_ATTACHMENT,
            runId: S.runnerState.runId,
            resultId: meta.resultId,
            fileName: evidence.name,
            base64Content,
            comment
        }, (res) => {
            resolve(res || { error: 'Sem resposta do background.' });
        });
    });
}

/** Esperas entre tentativas automaticas de envio (ms). Total de tentativas = 1 + length. */
export const UPLOAD_RETRY_DELAYS_MS = [2000, 5000];
export const UPLOAD_MAX_ATTEMPTS = 1 + UPLOAD_RETRY_DELAYS_MS.length;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function addAndUploadEvidence(tc, stepIdx, list, key, evidence) {
    evidence.status = 'uploading';
    evidence.attempt = 1;
    list.push(evidence);
    renderEvidenceList(list, key);
    refreshEvidenceIndicators(tc);

    let up;
    for (let attempt = 1; attempt <= UPLOAD_MAX_ATTEMPTS; attempt++) {
        evidence.attempt = attempt;
        evidence.status = 'uploading';
        renderEvidenceList(list, key);
        up = await uploadEvidenceToAzure(tc, stepIdx, evidence);
        if (!up?.error || up.local) break; // sucesso ou erro local (retry nao ajuda)
        if (attempt < UPLOAD_MAX_ATTEMPTS) await sleep(UPLOAD_RETRY_DELAYS_MS[attempt - 1]);
    }

    if (up?.error) {
        evidence.status = 'error';
        evidence.error = up.error;
        logEvent(`Falha ao anexar ${evidence.name}`);
        renderEvidenceList(list, key);
        refreshEvidenceIndicators(tc);
        return false;
    }
    evidence.status = 'uploaded';
    evidence.azureId = up.result?.id;
    // Drop heavy local blob after successful upload to free memory
    if (evidence.blob) delete evidence.blob;
    logEvent(`Evidência anexada: ${evidence.name}`);
    renderEvidenceList(list, key);
    refreshEvidenceIndicators(tc);
    return true;
}
