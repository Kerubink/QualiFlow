// Monta a mensagem de erro exibida quando o salvamento no board falha (total ou parcialmente).

export function buildSaveErrorMessage(response) {
    let errorMsg = response.error || 'Erro desconhecido ao salvar testes.';

    if (response.results && Array.isArray(response.results)) {
        const failed = response.results.filter((r) => r.status === 'error');
        if (failed.length > 0) {
            const detailed = failed.map((f) => `- ${f.title}: ${f.error || 'Sem mensagem'} `).join('\n');
            errorMsg += `\n\nDetalhes dos testes que falharam: \n${detailed} `;
        }
        const successCount = response.results.filter((r) => r.status === 'success').length;
        const failCount = response.results.filter((r) => r.status === 'error').length;
        if (response.partialSuccess) {
            errorMsg = `⚠️ SUCESSO PARCIAL: ${successCount} teste(s) criado(s), ${failCount} falharam.\n\n${errorMsg} `;
        }
    }

    return errorMsg;
}

export function countSuccesses(results) {
    return (results || []).filter((r) => r.status === 'success').length;
}
