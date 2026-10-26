// Conversao de casos de teste existentes (Azure) em cenarios editaveis para o fluxo de copia.

// Remove TODAS as palavras-chave Gherkin iniciais ("E ENTAO x" -> "x"), sem cortar "Exibe"/"Dados"/"E-mail".
const STEP_KEYWORD_RE = /^\s*(?:DADO|QUANDO|ENT[ÃA]O|E)\b(?:\s*[:,.]\s*|\s+)/i;

export function stripStepKeywords(text) {
    let clean = String(text || '').trim();
    for (;;) {
        const stripped = clean.replace(STEP_KEYWORD_RE, '').trim();
        if (stripped === clean) return clean;
        clean = stripped;
    }
}

export function buildCopiedBddDescription(steps) {
    if (!steps || steps.length === 0) return 'DADO contexto do card\nQUANDO executa o fluxo\nENTAO valida resultado esperado';

    const lines = [];
    for (let i = 0; i < Math.min(steps.length, 6); i += 1) {
        const step = steps[i];
        const raw = String(step.action || '').trim();
        const normalized = stripStepKeywords(raw);

        if (i === 0) lines.push(`DADO ${normalized || 'contexto inicial do cenário'}`);
        else if (i === 1) lines.push(`E ${normalized || 'pré-condição complementar'}`);
        else if (i === 2) lines.push(`QUANDO ${normalized || 'executa a ação principal'}`);
        else if (i === 3) lines.push(`ENTAO ${normalized || 'obtém o resultado esperado'}`);
        else lines.push(`E ${normalized || 'validações adicionais'}`);
    }

    return lines.join('\n');
}

export function convertTestCaseToScenario(tc, sourceCard) {
    const rawSteps = Array.isArray(tc.steps) ? tc.steps : [];
    const steps = rawSteps.map((step) => {
        const actionRaw = String(step.action || '').trim();
        const action = actionRaw || 'DADO executar ação';
        return {
            action,
            expected: String(step.expected || '').trim(),
            needs_evidence: /evidencia|evidência|valida|comprova|resultado/i.test(`${action} ${step.expected || ''}`)
        };
    });

    return {
        id_original: tc.id,
        title: tc.title || `CT #${tc.id}`,
        bdd_description: buildCopiedBddDescription(steps),
        steps,
        parameters: {},
        copied_from: {
            workItemId: sourceCard.id,
            workItemTitle: sourceCard.title,
            testCaseId: tc.id
        }
    };
}

// Cards candidatos a origem da copia: exclui o proprio card alvo.
export function filterCopySourceCards(cards, targetId) {
    return (cards || []).filter((card) => Number(card.id) !== Number(targetId));
}

// Modo manual (sem RTM) vs adaptado (com RTM).
export function isManualCopyContext(copyContext) {
    return Boolean(copyContext && copyContext.mode === 'manual');
}

export function shouldShowRtm(copyContext) {
    return !copyContext || copyContext.mode === 'adapted';
}
