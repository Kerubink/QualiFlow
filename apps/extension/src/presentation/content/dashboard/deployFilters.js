import { escapeHtml, getDashboardTypeStyle } from './helpers.js';

function flattenDeployNodes(nodes, depth = 0, acc = []) {
    (nodes || []).forEach(node => {
        acc.push({ node, depth });
        if (node.children && node.children.length > 0) {
            flattenDeployNodes(node.children, depth + 1, acc);
        }
    });
    return acc;
}

export function normalizeDeployText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

export function getDeployVisibleNodes(cards) {
    return flattenDeployNodes(cards).filter(({ node }) => node.liberado !== 'excluded');
}

export function matchesDeployFilters(node, filters) {
    const haystack = normalizeDeployText([
        node.id,
        node.title,
        node.type,
        node.state,
        node.effectiveState,
        node.area,
        (node.stackTags || []).join(' '),
        (node.qaResponsibles || []).join(' '),
        (node.tags || []).join(' '),
        (node.issues || []).join(' ')
    ].join(' '));

    if (filters.search && !haystack.includes(normalizeDeployText(filters.search))) return false;
    const selectedTypes = (filters.types || []).map(normalizeDeployText).filter(Boolean);
    if (selectedTypes.length > 0 && !selectedTypes.includes(normalizeDeployText(node.type || 'Sem tipo'))) return false;
    if (filters.state !== 'all' && normalizeDeployText(node.effectiveState || node.state) !== filters.state) return false;
    const selectedQa = (filters.qaList || []).map(normalizeDeployText).filter(Boolean);
    if (selectedQa.length > 0 && !(node.qaResponsibles || []).some(qa => selectedQa.includes(normalizeDeployText(qa)))) return false;
    if (filters.release !== 'all' && normalizeDeployText(node.liberado) !== filters.release) return false;

    const stack = (node.stackTags || []).map(normalizeDeployText).sort().join('+');
    if (filters.stack === 'front' && !stack.includes('front')) return false;
    if (filters.stack === 'back' && !stack.includes('back')) return false;
    if (filters.stack === 'tecnica' && !stack.includes('tecnica')) return false;
    if (filters.stack === 'front+back' && stack !== 'back+front' && stack !== 'front+back') return false;
    if (filters.stack === 'none' && (node.stackTags || []).length > 0) return false;

    return true;
}

function buildDeployChartRows(title, items) {
    const total = items.reduce((sum, item) => sum + item.count, 0) || 1;
    return `
        <div class="qualiflow-dep-chart">
            <div class="qualiflow-dep-chart-head">
                <div class="qualiflow-dep-chart-title">${title}</div>
                <div class="qualiflow-dep-chart-total">${items.reduce((sum, item) => sum + item.count, 0)} itens</div>
            </div>
            <div class="qualiflow-dep-chart-list">
                ${items.map(item => `
                    <div>
                        <div class="qualiflow-dep-chart-item-head">
                            <span>${escapeHtml(item.label)}</span>
                            <span>${item.count}</span>
                        </div>
                        <div class="qualiflow-dep-bar-track">
                            <div class="qualiflow-dep-bar-fill" style="--pct:${Math.max((item.count / total) * 100, item.count > 0 ? 4 : 0)}%; --c:${item.color};"></div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

export function buildDeployCharts(nodes) {
    const nodeList = nodes.map(item => item.node || item);

    const byRelease = [
        { label: 'Liberado', count: nodeList.filter(n => n.liberado === 'yes').length, color: 'var(--qf-success)' },
        { label: 'Pendente', count: nodeList.filter(n => n.liberado === 'pending').length, color: 'var(--qf-warning)' },
        { label: 'Com problema', count: nodeList.filter(n => n.liberado === 'no').length, color: 'var(--qf-danger)' }
    ];

    const byTypeMap = new Map();
    nodeList.forEach(node => {
        const key = node.type || 'Sem tipo';
        byTypeMap.set(key, (byTypeMap.get(key) || 0) + 1);
    });
    const byType = [...byTypeMap.entries()]
        .map(([label, count]) => ({ label, count, color: getDashboardTypeStyle(label).color }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);

    const byQaMap = new Map();
    nodeList.forEach(node => {
        (node.qaResponsibles || []).forEach(qa => {
            byQaMap.set(qa, (byQaMap.get(qa) || 0) + 1);
        });
    });
    const byQa = [...byQaMap.entries()]
        .map(([label, count]) => ({ label, count, color: 'var(--qf-info)' }))
        .sort((a, b) => b.count - a.count);

    return `
        <div class="qualiflow-dashboard-chart-grid">
            <div class="qualiflow-dashboard-chart-card">
                ${buildDeployChartRows('Liberação', byRelease)}
            </div>
            <div class="qualiflow-dashboard-chart-card">
                ${buildDeployChartRows('Tipos', byType)}
            </div>
            <div class="qualiflow-dashboard-chart-card">
                ${buildDeployChartRows('QA responsáveis', byQa)}
            </div>
        </div>
    `;
}
