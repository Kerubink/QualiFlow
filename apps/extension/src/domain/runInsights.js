/*
 * Metricas e textos do HUB da execucao. Modulo PURO (sem DOM): recebe dados ja lidos e devolve numeros/strings.
 */
import { formatDuration } from './runTimer.js';

const isUsable = (n) => Number.isFinite(n) && n >= 0;

/** Media de duracoes validas (ms); null se nao houver nenhuma. */
export function averageMs(values = []) {
    const ok = values.filter(isUsable);
    if (ok.length === 0) return null;
    return Math.round(ok.reduce((a, b) => a + b, 0) / ok.length);
}

/** Estimativa de tempo restante; null enquanto nao ha media para basear. */
export function estimateRemainingMs(avgMs, remaining) {
    if (!isUsable(avgMs) || !Number.isFinite(remaining) || remaining < 0) return null;
    return Math.round(avgMs * remaining);
}

/** Percentual de aprovados entre os CTs ja concluidos; null se nenhum concluido. */
export function passRate({ passed = 0, failed = 0, blocked = 0, other = 0 } = {}) {
    const done = passed + failed + blocked + other;
    return done === 0 ? null : Math.round((passed / done) * 100);
}

/** Totais de anexos por situacao a partir de varias listas de evidencias. */
export function evidenceTotals(lists = []) {
    const totals = { total: 0, uploaded: 0, pending: 0, error: 0 };
    lists.flat().forEach((ev) => {
        totals.total += 1;
        if (ev.status === 'uploaded') totals.uploaded += 1;
        else if (ev.status === 'error') totals.error += 1;
        else totals.pending += 1;
    });
    return totals;
}

export function parseBrowser(userAgent = '') {
    const rules = [
        [/Edg\/([\d.]+)/, 'Edge'],
        [/OPR\/([\d.]+)/, 'Opera'],
        [/Firefox\/([\d.]+)/, 'Firefox'],
        [/Chrome\/([\d.]+)/, 'Chrome'],
        [/Version\/([\d.]+).*Safari/, 'Safari']
    ];
    for (const [re, name] of rules) {
        const m = userAgent.match(re);
        if (m) return `${name} ${m[1].split('.')[0]}`;
    }
    return 'Desconhecido';
}

export function parseOs(userAgent = '') {
    if (/Windows NT 10/.test(userAgent)) return 'Windows 10/11';
    if (/Windows/.test(userAgent)) return 'Windows';
    if (/Android/.test(userAgent)) return 'Android';
    if (/iPhone|iPad|iPod/.test(userAgent)) return 'iOS';
    if (/Mac OS X/.test(userAgent)) return 'macOS';
    if (/CrOS/.test(userAgent)) return 'ChromeOS';
    if (/Linux/.test(userAgent)) return 'Linux';
    return 'Desconhecido';
}

/** Texto pronto para colar em um bug. */
export function buildEnvironmentText(info = {}) {
    const lines = [
        ['URL', info.url],
        ['Navegador', info.browser],
        ['Sistema', info.os],
        ['Janela (viewport)', info.viewport],
        ['Breakpoint', info.breakpoint],
        ['Tela', info.screen],
        ['Zoom/escala', info.pixelRatio],
        ['Idioma', info.language],
        ['Fuso horário', info.timezone],
        ['Data/hora', info.dateTime]
    ];
    return lines.filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => `${k}: ${v}`).join('\n');
}

/** Linha de atividade: "14:03:22  mensagem". `time` ja vem formatado pela camada de apresentacao. */
export function formatEventLine(time, text) {
    return `${time}  ${text}`;
}

/** Rotulo curto para tempo pausado: "2 pausas, 01:30" ou "Nenhuma". */
export function describePauses(count = 0, totalMs = 0) {
    if (!count) return 'Nenhuma';
    return `${count} ${count === 1 ? 'pausa' : 'pausas'}, ${formatDuration(totalMs)}`;
}
