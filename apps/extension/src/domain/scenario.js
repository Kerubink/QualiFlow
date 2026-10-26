import { isValidAzureAssignee } from "./board.js";

// Normalizacao pura de cenarios de teste e parametros @campo.

const PARAM_PLACEHOLDER = '###';

export function extractScenarioParams(item) {
    const stepsText = item?.steps?.map((s) => `${s.action || ''} ${s.expected || ''}`).join(' ') || '';
    const textToScan = `${item?.title || ''} ${item?.bdd_description || ''} ${stepsText}`;
    return [...new Set((textToScan.match(/@\w+/g) || []).map((p) => p.trim()))];
}

// Garante que todo parametro @campo detectado tenha valor padrao antes de salvar.
export function ensureScenarioParamsDefault(item) {
    const paramNames = extractScenarioParams(item);
    if (paramNames.length === 0) return;

    item.parameters = item.parameters || {};
    for (const pName of paramNames) {
        if (!item.parameters[pName] || item.parameters[pName].trim() === '') {
            item.parameters[pName] = PARAM_PLACEHOLDER;
        }
    }
}

// Converte o texto editavel "acao || esperado" (marcador [EV] = evidencia) em passos.
// O separador de linha e a sequencia literal "\n" (barra + n), como gravada pelo editor.
export function parseStepsFromText(text) {
    return text.split('\\n')
        .filter((line) => line.trim() !== '')
        .map((line) => {
            const parts = line.split('||');
            let actionText = parts[0] ? parts[0].trim() : '';
            const needsEvidence = actionText.includes('[EV]');
            if (needsEvidence) actionText = actionText.replace('[EV]', '').trim();

            return {
                action: actionText,
                expected: parts[1] ? parts[1].trim() : '',
                needs_evidence: needsEvidence
            };
        });
}

// Detecta @parametros no BDD/passos (usado para sinalizar cenarios com parametros pendentes).
export function scenarioHasUnfilledParams(sc) {
    const hasParams = /@\w+/.test(sc.bdd_description) || sc.steps.some((st) => /@\w+/.test(st.action) || /@\w+/.test(st.expected));
    const allFilled = sc.parameters && Object.keys(sc.parameters).length > 0 && Object.values(sc.parameters).every((v) => v && v.trim() !== '');
    return Boolean(hasParams && !allFilled);
}

export function scenarioTitleLabel(sc) {
    return sc.title + (sc.id_original ? ` [ID ${sc.id_original}]` : ' [Novo]');
}

// Prepara uma copia do cenario para salvar no board: assignee valido do Azure, sem tags
// proprias (usa so as do work item pai) e parametros com valor padrao.
export function prepareScenarioForSave(scenario) {
    const copy = { ...scenario };
    const assignee = copy.assignedTo?.trim();
    if (!assignee || !isValidAzureAssignee(assignee)) {
        delete copy.assignedTo;
    } else {
        copy.assignedTo = assignee;
    }
    delete copy.tags;
    ensureScenarioParamsDefault(copy);
    return copy;
}

// Dados do card enviados a IA: criterios editados na UI substituem os originais quando preenchidos.
export function withEditedAcceptance(workItem, editedAcceptance) {
    return Object.assign({}, workItem, { acceptance_criteria: editedAcceptance || workItem.acceptance_criteria });
}

// Remove payloads grandes (XML dos testes existentes) que nao sao necessarios para salvar.
export function stripExistingTests(workItem) {
    const clean = { ...workItem };
    delete clean.existing_tests;
    return clean;
}
