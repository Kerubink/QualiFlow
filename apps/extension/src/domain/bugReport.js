/* Texto do bug aberto a partir de um passo reprovado (HTML do campo Repro Steps). Modulo PURO. */
import { decodeEntities, escapeHtmlText, outcomeLabel, plainText } from './runReport.js';

export const SEVERITIES = Object.freeze([
    { key: 'critical', label: '1 - Crítica' },
    { key: 'high', label: '2 - Alta' },
    { key: 'medium', label: '3 - Média' },
    { key: 'low', label: '4 - Baixa' }
]);

export function normalizeSeverity(value) {
    const key = String(value || '').toLowerCase();
    return SEVERITIES.some((s) => s.key === key) ? key : null;
}

export function buildBugTitle(tc, step) {
    const short = (step ? plainText(step.action) : decodeEntities(tc.title)).replace(/\s+/g, ' ');
    const clipped = short.length > 80 ? `${short.slice(0, 77)}...` : short;
    return `[BUG] CT ${tc.id}, passo ${step?.order ?? '?'}: ${clipped}`;
}

const pre = (text) => `<pre>${escapeHtmlText(text)}</pre>`;
const section = (title, body) => `<h3>${escapeHtmlText(title)}</h3>${body}`;

/**
 * @param {object} d { tc, stepIndex, steps (resultados), comment, environment, probeText, evidenceNames, severityLabel }
 */
export function buildBugReproHtml(d) {
    const step = d.tc.steps[d.stepIndex];
    const parts = [];
    parts.push(`<p><b>Caso de teste:</b> #${escapeHtmlText(d.tc.id)} - ${escapeHtmlText(decodeEntities(d.tc.title))}</p>`);
    if (d.severityLabel) parts.push(`<p><b>Severidade:</b> ${escapeHtmlText(d.severityLabel)}</p>`);

    const upTo = d.tc.steps.slice(0, d.stepIndex + 1).map((s, i) => {
        const res = d.steps?.[i];
        const outcome = i === d.stepIndex ? 'Failed' : res?.outcome;
        return `<li>${escapeHtmlText(plainText(s.action))}${outcome && outcome !== 'None' ? ` <i>(${escapeHtmlText(outcomeLabel(outcome))})</i>` : ''}</li>`;
    }).join('');
    parts.push(section('Passos executados até a falha', `<ol>${upTo}</ol>`));

    parts.push(section('Passo que falhou', `<p><b>Ação:</b> ${escapeHtmlText(plainText(step.action))}</p>` +
        `<p><b>Resultado esperado:</b> ${escapeHtmlText(plainText(step.expected) || '(não informado)')}</p>` +
        `<p><b>Resultado obtido:</b> ${escapeHtmlText(String(d.comment || '').trim() || '(não informado)')}</p>`));
    if (d.environment) parts.push(section('Ambiente', pre(d.environment)));
    if (d.probeText) parts.push(section('Erros de console e rede (durante o passo)', pre(d.probeText)));
    if (d.evidenceNames && d.evidenceNames.length) {
        parts.push(section('Evidências', `<ul>${d.evidenceNames.map((n) => `<li>${escapeHtmlText(n)}</li>`).join('')}</ul>`));
    }
    parts.push('<p><i>Aberto pelo QualiFlow Runner.</i></p>');
    return parts.join('');
}
