// Le um token --qf-* do :root; usa o fallback quando indisponivel.
export function qfToken(name, fallback) {
    try {
        const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
        return value || fallback;
    } catch (_err) {
        return fallback;
    }
}

// `variant` e a variante de .qualiflow-badge-*; `color` segue disponivel para graficos.
export function getDashboardTypeStyle(type) {
    const t = (type || '').toLowerCase();
    if (t.includes('bug')) return { icon: '🐞', color: qfToken('--qf-danger', '#ef4444'), variant: 'danger', label: 'Bug' };
    if (t.includes('story') || t.includes('product backlog item') || t.includes('pbi')) return { icon: '📘', color: qfToken('--qf-info', '#3b82f6'), variant: 'info', label: 'PBI' };
    if (t.includes('task')) return { icon: '📋', color: qfToken('--qf-warning', '#f59e0b'), variant: 'warning', label: 'Task' };
    if (t.includes('epic')) return { icon: '👑', color: qfToken('--qf-violet', '#8b5cf6'), variant: 'violet', label: 'Epic' };
    if (t.includes('feature')) return { icon: '🏆', color: qfToken('--qf-success-solid', '#10b981'), variant: 'success', label: 'Feature' };
    return { icon: '📄', color: qfToken('--qf-text-muted', '#94a3b8'), variant: 'neutral', label: type || 'Item' };
}

export function getIterationLabel(value) {
    const raw = String(value || 'Desconhecido');
    return raw.split('\\').pop() || raw;
}

export function parseTagList(rawTags) {
    return String(rawTags || '')
        .split(';')
        .map((tag) => tag.trim())
        .filter(Boolean);
}

export function normalizeAnalyticsToken(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

export function detectStackFromTags(tags) {
    const normalized = tags.map(normalizeAnalyticsToken);
    const hasFront = normalized.some((tag) => tag === 'front' || tag === 'frontend' || tag === 'ui');
    const hasBack = normalized.some((tag) => tag === 'back' || tag === 'backend' || tag === 'api');
    const hasTech = normalized.some((tag) => tag === 'tecnica' || tag === 'tecnico' || tag === 'technical' || tag === 'tecnico-debito');

    if (hasFront && hasBack) return 'Front + Back';
    if (hasFront) return 'Front';
    if (hasBack) return 'Back';
    if (hasTech) return 'Tecnico';
    return 'Nao classificado';
}

export const OFFICIAL_TEST_PREFIXES = [
    'UI', 'FUNC', 'UX', 'ACC', 'INT',
    'SCHEMA', 'SEG', 'PERF',
    'VALID', 'REG', 'SMOKE', 'E2E'
];

export function getSprintNumber(value) {
    const label = getIterationLabel(value);
    const match = String(label).match(/sprint\s*(\d+)/i);
    return match ? Number(match[1]) : null;
}

export function compareIterations(a, b) {
    const na = getSprintNumber(a);
    const nb = getSprintNumber(b);
    if (na !== null && nb !== null) return na - nb;
    return String(a).localeCompare(String(b), 'pt-BR');
}

export function extractTestPrefix(title) {
    const text = String(title || '').trim().toUpperCase();
    const tokenMatch = text.match(/^\[?\s*([A-Z0-9]{2,10})\s*\]?(?:[\s:_-]|$)/);
    const token = tokenMatch ? tokenMatch[1] : '';

    if (OFFICIAL_TEST_PREFIXES.includes(token)) return token;
    return 'OUTROS';
}

export function extractQaLabel(parentTags, testTags, assignedTo) {
    const allTags = [...parentTags, ...testTags];
    for (const tag of allTags) {
        const qaMatch = tag.match(/^qa[\s:_-]*(.+)$/i);
        if (qaMatch && qaMatch[1] && qaMatch[1].trim()) {
            return qaMatch[1].trim();
        }
    }

    const filtered = allTags.filter((tag) => {
        const token = normalizeAnalyticsToken(tag);
        return !['front', 'frontend', 'ui', 'back', 'backend', 'api', 'tecnica', 'tecnico', 'technical'].includes(token);
    });
    if (filtered.length > 0) return filtered[0];

    if (assignedTo) {
        return String(assignedTo).trim().split(/\s+/)[0] || 'Sem QA';
    }
    return 'Sem QA';
}

export function mapColorByIndex(index) {
    const palette = [
        qfToken('--qf-sky', '#06b6d4'), qfToken('--qf-success', '#22c55e'), qfToken('--qf-warning', '#f59e0b'),
        qfToken('--qf-danger', '#ef4444'), qfToken('--qf-violet', '#8b5cf6'), '#14b8a6', '#f97316',
        qfToken('--qf-info', '#3b82f6'), '#a855f7', '#84cc16'
    ];
    return palette[index % palette.length];
}

export function buildAnalyticsBars(items, totalCount) {
    if (!items.length) {
        return '<div class="qualiflow-empty qualiflow-dsh-empty" role="status">Sem dados para o filtro selecionado.</div>';
    }

    return `
        <div class="qualiflow-dsh-bars">
            ${items.map((item, index) => {
            const total = totalCount || 1;
            const width = Math.max((item.value / total) * 100, item.value > 0 ? 3 : 0);
            const color = mapColorByIndex(index);
            return `
                    <div>
                        <div class="qualiflow-dsh-bar-head">
                            <span>${escapeHtml(item.label)}</span>
                            <span>${item.value}</span>
                        </div>
                        <div class="qualiflow-dsh-bar-track">
                            <div class="qualiflow-dsh-bar-fill" style="--pct:${width}%; --c:${color};"></div>
                        </div>
                    </div>
                `;
        }).join('')}
        </div>
    `;
}

export function toSortedEntries(countMap, maxItems = 8) {
    return [...countMap.entries()]
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, maxItems);
}

export function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
