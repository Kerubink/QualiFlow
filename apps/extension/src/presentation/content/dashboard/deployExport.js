import { escapeHtml } from './helpers.js';
import { normalizeDeployText } from './deployFilters.js';

export function matchesDeployExportFilters(node, options = {}) {
    if (!node) return false;

    if (options.release && options.release !== 'all' && normalizeDeployText(node.liberado) !== options.release) {
        return false;
    }

    const selectedResponsibles = (options.responsibles || []).map(normalizeDeployText).filter(Boolean);
    if (selectedResponsibles.length > 0) {
        const nodeResponsibles = (node.qaResponsibles || []).map(normalizeDeployText);
        if (!nodeResponsibles.some(qa => selectedResponsibles.includes(qa))) return false;
    }

    const selectedTypes = (options.types || []).map(normalizeDeployText).filter(Boolean);
    if (selectedTypes.length > 0) {
        if (!selectedTypes.includes(normalizeDeployText(node.type || 'Sem tipo'))) return false;
    }

    return true;
}

export function getDeployExportColumns() {
    const defaults = ['id', 'title', 'type', 'qa', 'release'];
    const all = ['id', 'title', 'type', 'state', 'stack', 'qa', 'tags', 'release', 'issues', 'area'];
    return all.filter(key => {
        const el = document.getElementById(`qualiflow-export-col-${key}`);
        if (!el) return defaults.includes(key);
        return !!el.checked;
    });
}

function formatExportCell(value, maxLen = 54) {
    const text = String(value ?? '').replace(/\s+/g, ' ').trim();
    if (text.length <= maxLen) return text;
    return `${text.slice(0, Math.max(maxLen - 1, 1))}…`;
}

function buildExportRowData(rows) {
    return rows.map(({ node }) => ({
        id: `#${node.id}`,
        title: node.title || '',
        type: node.type || '',
        state: node.effectiveState || node.state || '',
        stack: (node.stackTags || []).join(' + '),
        qa: (node.qaResponsibles || []).join(', '),
        tags: node.hasDeployTag ? 'Liberado deploy' : '',
        release: node.liberado === 'yes' ? 'Liberado' : node.liberado === 'pending' ? 'Pendente' : 'Com problema',
        issues: (node.issues || []).join('; '),
        area: node.area || ''
    }));
}

function buildTeamsTable(rows, columns) {
    const headers = {
        id: 'ID',
        title: 'Card',
        type: 'Tipo',
        state: 'Estado',
        stack: 'Stack',
        qa: 'QA',
        tags: 'Tags',
        release: 'Liberação',
        issues: 'Problemas',
        area: 'Área'
    };

    const formattedRows = buildExportRowData(rows);
    const maxLengths = {};
    columns.forEach(col => {
        maxLengths[col] = headers[col].length;
    });

    formattedRows.forEach(row => {
        columns.forEach(col => {
            const len = String(row[col] || '').length;
            if (len > maxLengths[col]) maxLengths[col] = len;
        });
    });

    const pad = (value, len) => String(value ?? '').padEnd(len, ' ');
    const headerLine = `| ${columns.map(col => pad(headers[col], maxLengths[col])).join(' | ')} |`;
    const separatorLine = `| ${columns.map(col => '-'.repeat(Math.max(maxLengths[col], headers[col].length))).join(' | ')} |`;
    const dataLines = formattedRows.map(row => `| ${columns.map(col => pad(formatExportCell(row[col], Math.max(maxLengths[col], 18)), maxLengths[col])).join(' | ')} |`);
    return [headerLine, separatorLine, ...dataLines].join('\n');
}

function buildExportPlainText(rows, options) {
    const groupBy = options.groupBy || 'none';
    const columns = options.columns || ['id', 'title', 'type', 'qa', 'release'];
    const visibleRows = rows.filter(({ node }) => matchesDeployExportFilters(node, options));

    const sprintName = (options.iterationPath || '').split('\\').pop() || options.iterationPath || 'Sprint';
    const releaseLabel = options.release === 'yes' ? 'Liberados' : options.release === 'pending' ? 'Pendentes' : options.release === 'no' ? 'Com problema' : 'Todos';
    const filtersLabel = [
        options.release !== 'all' ? `Liberação: ${releaseLabel}` : null,
        options.responsibles && options.responsibles.length > 0 ? `Responsáveis: ${options.responsibles.join(', ')}` : null,
        options.types && options.types.length > 0 ? `Tipos: ${options.types.join(', ')}` : null
    ].filter(Boolean).join(' | ');
    const columnsLabel = columns.map(col => ({
        id: 'ID',
        title: 'Card',
        type: 'Tipo',
        state: 'Estado',
        stack: 'Stack',
        qa: 'QA',
        tags: 'Tags',
        release: 'Liberação',
        issues: 'Problemas',
        area: 'Área'
    }[col])).join(', ');

    const lines = [];
    lines.push(`Deploy ${sprintName}`);
    if (options.iterationPath) lines.push(`Sprint: ${options.iterationPath}`);
    lines.push(`Gerado em: ${new Date().toLocaleString('pt-BR')}`);
    lines.push(`Itens exportados: ${visibleRows.length}`);
    if (filtersLabel) lines.push(`Filtros: ${filtersLabel}`);
    lines.push(`Colunas: ${columnsLabel}`);
    lines.push('');

    if (groupBy === 'responsible') {
        const map = new Map();
        visibleRows.forEach(row => {
            const names = row.node.qaResponsibles && row.node.qaResponsibles.length > 0 ? row.node.qaResponsibles : ['Sem responsável'];
            names.forEach(name => {
                if (!map.has(name)) map.set(name, []);
                map.get(name).push(row);
            });
        });
        [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR')).forEach(([groupName, groupRows]) => {
            lines.push(`[${groupName}]`);
            lines.push(buildTeamsTable(groupRows, columns));
            lines.push('');
        });
    } else if (groupBy === 'type') {
        const map = new Map();
        visibleRows.forEach(row => {
            const key = row.node.type || 'Sem tipo';
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(row);
        });
        [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR')).forEach(([groupName, groupRows]) => {
            lines.push(`[${groupName}]`);
            lines.push(buildTeamsTable(groupRows, columns));
            lines.push('');
        });
    } else if (groupBy === 'area') {
        const map = new Map();
        visibleRows.forEach(row => {
            const key = row.node.area || 'Sem área';
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(row);
        });
        [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR')).forEach(([groupName, groupRows]) => {
            lines.push(`[${groupName}]`);
            lines.push(buildTeamsTable(groupRows, columns));
            lines.push('');
        });
    } else if (groupBy === 'stack') {
        const map = new Map();
        visibleRows.forEach(row => {
            const key = (row.node.stackTags && row.node.stackTags.length > 0) ? row.node.stackTags.join(' + ') : 'Sem stack';
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(row);
        });
        [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR')).forEach(([groupName, groupRows]) => {
            lines.push(`[${groupName}]`);
            lines.push(buildTeamsTable(groupRows, columns));
            lines.push('');
        });
    } else {
        lines.push(buildTeamsTable(visibleRows, columns));
    }

    return lines.join('\n').trim();
}

function buildExportHtmlTable(rows, columns) {
    const headers = {
        id: 'ID',
        title: 'Card',
        type: 'Tipo',
        state: 'Estado',
        stack: 'Stack',
        qa: 'QA',
        tags: 'Tags',
        release: 'Liberação',
        issues: 'Problemas',
        area: 'Área'
    };
    const data = buildExportRowData(rows);
    const thStyle = 'border:1px solid #94a3b8; padding:6px 8px; background:#0f172a; color:#ffffff; text-align:left; vertical-align:top;';
    const tdStyle = 'border:1px solid #94a3b8; padding:6px 8px; color:#111827; vertical-align:top; white-space:normal; overflow-wrap:anywhere;';

    const headerHtml = `<tr>${columns.map(col => `<th style="${thStyle}">${escapeHtml(headers[col])}</th>`).join('')}</tr>`;
    const bodyHtml = data.map(row => `<tr>${columns.map(col => `<td style="${tdStyle}">${escapeHtml(row[col] || '')}</td>`).join('')}</tr>`).join('');

    return `
        <div style="width:100%; overflow-x:auto;">
            <table style="border-collapse:collapse; width:100%; table-layout:fixed; font-family:Segoe UI, Arial, sans-serif; font-size:12px;">
                <thead>${headerHtml}</thead>
                <tbody>${bodyHtml}</tbody>
            </table>
        </div>
    `.trim();
}

export function buildDeployExportText(rows, options) {
    return buildExportPlainText(rows, options);
}

export function buildDeployExportHtml(rows, options) {
    const groupBy = options.groupBy || 'none';
    const columns = options.columns || ['id', 'title', 'type', 'qa', 'release'];
    const visibleRows = rows.filter(({ node }) => matchesDeployExportFilters(node, options));

    const sprintName = (options.iterationPath || '').split('\\').pop() || options.iterationPath || 'Sprint';
    const sections = [];
    const makeSection = (title, rowsForSection) => {
        sections.push(`
            <h3 style="font-family:Segoe UI, Arial, sans-serif; color:#0f172a; margin:16px 0 8px 0;">${escapeHtml(title)}</h3>
            ${buildExportHtmlTable(rowsForSection, columns)}
        `);
    };

    if (groupBy === 'responsible') {
        const map = new Map();
        visibleRows.forEach(row => {
            const names = row.node.qaResponsibles && row.node.qaResponsibles.length > 0 ? row.node.qaResponsibles : ['Sem responsável'];
            names.forEach(name => {
                if (!map.has(name)) map.set(name, []);
                map.get(name).push(row);
            });
        });
        [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR')).forEach(([groupName, groupRows]) => makeSection(groupName, groupRows));
    } else if (groupBy === 'type') {
        const map = new Map();
        visibleRows.forEach(row => {
            const key = row.node.type || 'Sem tipo';
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(row);
        });
        [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR')).forEach(([groupName, groupRows]) => makeSection(groupName, groupRows));
    } else if (groupBy === 'area') {
        const map = new Map();
        visibleRows.forEach(row => {
            const key = row.node.area || 'Sem área';
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(row);
        });
        [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR')).forEach(([groupName, groupRows]) => makeSection(groupName, groupRows));
    } else if (groupBy === 'stack') {
        const map = new Map();
        visibleRows.forEach(row => {
            const key = (row.node.stackTags && row.node.stackTags.length > 0) ? row.node.stackTags.join(' + ') : 'Sem stack';
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(row);
        });
        [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR')).forEach(([groupName, groupRows]) => makeSection(groupName, groupRows));
    } else {
        sections.push(buildExportHtmlTable(visibleRows, columns));
    }

    return `
        <div style="font-family:Segoe UI, Arial, sans-serif; color:#111827;">
            <div style="margin-bottom:8px;"><strong>Deploy ${escapeHtml(sprintName)}</strong></div>
            ${options.iterationPath ? `<div style="margin-bottom:4px;">Sprint: ${escapeHtml(options.iterationPath)}</div>` : ''}
            <div style="margin-bottom:4px;">Gerado em: ${escapeHtml(new Date().toLocaleString('pt-BR'))}</div>
            <div style="margin-bottom:4px;">Itens exportados: ${visibleRows.length}</div>
            ${sections.join('')}
        </div>
    `.trim();
}

export async function copyRichTeamsExport(html, text) {
    const htmlBlob = new Blob([html], { type: 'text/html' });
    const textBlob = new Blob([text], { type: 'text/plain' });

    if (navigator.clipboard && window.ClipboardItem) {
        try {
            await navigator.clipboard.write([
                new ClipboardItem({
                    'text/html': htmlBlob,
                    'text/plain': textBlob
                })
            ]);
            return;
        } catch {
            // fallback to plain text
        }
    }

    await navigator.clipboard.writeText(text);
}
