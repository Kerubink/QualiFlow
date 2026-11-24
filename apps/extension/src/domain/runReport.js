/* Relatorio final da execucao em Markdown e HTML. Modulo PURO (texto simples entra, string sai). */
import { formatDuration } from './runTimer.js';

const OUTCOME_LABEL = {
    Passed: 'Aprovado', Failed: 'Reprovado', Blocked: 'Bloqueado', Paused: 'Pausado', NotApplicable: 'Não aplicável', None: 'Sem resultado'
};
export const outcomeLabel = (o) => OUTCOME_LABEL[o] || (o ? String(o) : OUTCOME_LABEL.None);

/** Decodifica entidades HTML comuns (titulos podem vir codificados). Nao remove tags. */
export function decodeEntities(value) {
    return String(value ?? '')
        .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}

/**
 * Remove tags HTML e decodifica entidades. Use SO em campos que vem em HTML do Azure (acao/esperado dos passos);
 * titulos e textos digitados pelo QA sao texto puro e nao devem perder o que estiver entre < >.
 */
export function plainText(value) {
    return decodeEntities(String(value ?? '')
        .replace(/<\s*br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|li)>/gi, '\n')
        .replace(/<[^>]*>/g, ''))
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

export const escapeHtmlText = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mdEscape = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const mdCell = (s) => mdEscape(plainText(s));
const dur = (ms) => (Number.isFinite(ms) ? formatDuration(ms) : '--');
const when = (ms) => (ms ? new Date(ms).toLocaleString('pt-BR') : '--');

export function buildMarkdownReport(d) {
    const s = d.summary || {};
    const L = [];
    L.push(`# Relatório de execução - PBI #${d.workItemId}`);
    if (d.workItemTitle) L.push('', `**${decodeEntities(d.workItemTitle)}**`);
    L.push('', `- Início: ${when(d.startedAt)}`, `- Fim: ${when(d.finishedAt)}`, `- Tempo total: ${dur(d.totalMs)}`);
    if (d.pauses) L.push(`- Pausas: ${d.pauses}`);
    L.push('', '## Resumo', '', '| Total | Aprovados | Reprovados | Bloqueados/outros | Sem resultado | Taxa de aprovação |', '| --- | --- | --- | --- | --- | --- |',
        `| ${s.total ?? 0} | ${s.passed ?? 0} | ${s.failed ?? 0} | ${(s.blocked ?? 0) + (s.other ?? 0)} | ${s.pending ?? 0} | ${d.passRate === null || d.passRate === undefined ? '--' : `${d.passRate}%`} |`);
    if (d.environment) L.push('', '## Ambiente', '', '```', d.environment, '```');
    L.push('', '## Casos de teste');
    (d.cases || []).forEach((c) => {
        L.push('', `### CT #${c.id} - ${decodeEntities(c.title)}`, '', `- Resultado: **${outcomeLabel(c.outcome)}**`, `- Duração: ${dur(c.durationMs)}`);
        if (c.comment) L.push(`- Observação: ${c.comment}`);
        if (c.steps && c.steps.length) {
            L.push('', '| # | Ação | Resultado esperado | Resultado | Tempo |', '| --- | --- | --- | --- | --- |');
            c.steps.forEach((st) => {
                L.push(`| ${st.order} | ${mdCell(st.action)} | ${mdCell(st.expected)} | ${outcomeLabel(st.outcome)}${st.comment ? ` - ${mdEscape(st.comment)}` : ''} | ${dur(st.durationMs)} |`);
            });
        }
        if (c.evidences && c.evidences.length) {
            L.push('', 'Evidências:', ...c.evidences.map((e) => `- ${e.name} (${e.status === 'uploaded' ? 'enviada ao Azure' : 'não enviada'})`));
        }
    });
    if (d.bugs && d.bugs.length) L.push('', '## Bugs criados', '', ...d.bugs.map((b) => `- Bug #${b.id} (CT #${b.tcId})`));
    if (d.notes) L.push('', '## Notas', '', d.notes);
    return L.join('\n') + '\n';
}

export function buildHtmlReport(d) {
    const e = escapeHtmlText;
    const s = d.summary || {};
    const rows = (c) => (c.steps || []).map((st) => `<tr><td>${e(st.order)}</td><td>${e(plainText(st.action))}</td><td>${e(plainText(st.expected))}</td><td class="o-${e(st.outcome)}">${e(outcomeLabel(st.outcome))}${st.comment ? `<br><small>${e(st.comment)}</small>` : ''}</td><td>${e(dur(st.durationMs))}</td></tr>`).join('');
    const cases = (d.cases || []).map((c) => `
<section><h3>CT #${e(c.id)} - ${e(decodeEntities(c.title))}</h3>
<p><span class="badge o-${e(c.outcome)}">${e(outcomeLabel(c.outcome))}</span> Duração: ${e(dur(c.durationMs))}${c.comment ? `<br>Observação: ${e(c.comment)}` : ''}</p>
${c.steps && c.steps.length ? `<table><thead><tr><th>#</th><th>Ação</th><th>Resultado esperado</th><th>Resultado</th><th>Tempo</th></tr></thead><tbody>${rows(c)}</tbody></table>` : ''}
${c.evidences && c.evidences.length ? `<p>Evidências: ${c.evidences.map((x) => e(x.name)).join(', ')}</p>` : ''}
</section>`).join('');
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório - PBI #${e(d.workItemId)}</title>
<style>body{font:14px/1.5 system-ui,sans-serif;max-width:960px;margin:24px auto;padding:0 16px;color:#1b2433}table{border-collapse:collapse;width:100%;margin:8px 0}th,td{border:1px solid #d5dbe5;padding:6px 8px;text-align:left;vertical-align:top}th{background:#f1f4f9}.badge{padding:2px 8px;border-radius:10px;background:#e3e7ef;font-weight:600}.o-Passed{color:#13803c}.o-Failed{color:#b3261e}pre{background:#f1f4f9;padding:8px;overflow:auto}</style></head><body>
<h1>Relatório de execução - PBI #${e(d.workItemId)}</h1>
${d.workItemTitle ? `<p><strong>${e(decodeEntities(d.workItemTitle))}</strong></p>` : ''}
<ul><li>Início: ${e(when(d.startedAt))}</li><li>Fim: ${e(when(d.finishedAt))}</li><li>Tempo total: ${e(dur(d.totalMs))}</li>${d.pauses ? `<li>Pausas: ${e(d.pauses)}</li>` : ''}</ul>
<h2>Resumo</h2><table><thead><tr><th>Total</th><th>Aprovados</th><th>Reprovados</th><th>Bloqueados/outros</th><th>Sem resultado</th><th>Taxa de aprovação</th></tr></thead><tbody><tr><td>${e(s.total ?? 0)}</td><td>${e(s.passed ?? 0)}</td><td>${e(s.failed ?? 0)}</td><td>${e((s.blocked ?? 0) + (s.other ?? 0))}</td><td>${e(s.pending ?? 0)}</td><td>${d.passRate === null || d.passRate === undefined ? '--' : `${e(d.passRate)}%`}</td></tr></tbody></table>
${d.environment ? `<h2>Ambiente</h2><pre>${e(d.environment)}</pre>` : ''}
<h2>Casos de teste</h2>${cases}
${d.bugs && d.bugs.length ? `<h2>Bugs criados</h2><ul>${d.bugs.map((b) => `<li>Bug #${e(b.id)} (CT #${e(b.tcId)})</li>`).join('')}</ul>` : ''}
${d.notes ? `<h2>Notas</h2><p>${e(d.notes).replace(/\n/g, '<br>')}</p>` : ''}
</body></html>`;
}
