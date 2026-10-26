// Regras de apresentacao/classificacao da matriz de rastreabilidade (RTM) no lado cliente.

export function isRtmRowCovered(row) {
    const statusLower = (row.status || '').toLowerCase();
    return statusLower.includes('good') || statusLower.includes('covered') ||
        statusLower.includes('coberto') || statusLower.includes('parcial') ||
        statusLower.includes('ok') || Boolean(row.covered_by_scenarios && row.covered_by_scenarios.length > 0);
}

// Remove prefixo "AC1:"/"AC1.2:" duplicado quando a IA ja o incluiu no criterio.
export function stripCriteriaPrefix(criteria) {
    return criteria.replace(/^AC\d+(\.\d+)?:\s*/i, '');
}
