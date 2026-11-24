/* Relatorio da execucao: coleta dados do estado do runner e exporta (Markdown copiado / HTML baixado). */
import { S } from './state.js';
import { buildHtmlReport, buildMarkdownReport } from '../../../domain/runReport.js';
import { buildEnvironmentText, describePauses, passRate } from '../../../domain/runInsights.js';
import { summarizeRun } from '../../../domain/runTimer.js';
import { runElapsedMs } from './timers.js';
import { copyText, environmentInfo } from './envInfo.js';

function evidencesFor(st, tcId) {
    const out = [];
    Object.entries(st.evidences || {}).forEach(([key, list]) => {
        if (key === String(tcId) || key.startsWith(`${tcId}_step_`)) list.forEach((e) => out.push({ name: e.name, status: e.status }));
    });
    return out;
}

export function collectReportData() {
    const st = S.runnerState;
    const summary = summarizeRun(st.testCases, st.finalOutcomes || {}, st.currentTcIndex);
    const cases = st.testCases.map((tc) => {
        const results = st.stepResults?.[tc.id] || [];
        return {
            id: tc.id,
            title: tc.title,
            outcome: st.finalOutcomes?.[tc.id],
            durationMs: st.ctDurations?.[tc.id],
            comment: st.comments?.[tc.id],
            steps: (tc.steps || []).map((s, i) => ({
                order: s.order, action: s.action, expected: s.expected,
                outcome: results[i]?.outcome, comment: results[i]?.comment, durationMs: results[i]?.durationMs
            })),
            evidences: evidencesFor(st, tc.id)
        };
    });
    return {
        workItemId: S.activeSession?.workItemId,
        workItemTitle: S.activeSession?.workItemTitle,
        startedAt: st.startedAt,
        finishedAt: Date.now(),
        totalMs: runElapsedMs(),
        pauses: st.pauseCount ? describePauses(st.pauseCount, st.pausedMs) : '',
        environment: buildEnvironmentText(environmentInfo()),
        summary,
        passRate: passRate(summary),
        cases,
        bugs: st.bugs || [],
        notes: S.hubNotes
    };
}

export function copyReportMarkdown() {
    return copyText(buildMarkdownReport(collectReportData()));
}

export function downloadReportHtml() {
    const data = collectReportData();
    const blob = new Blob([buildHtmlReport(data)], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-pbi-${data.workItemId}-${stamp}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
}
