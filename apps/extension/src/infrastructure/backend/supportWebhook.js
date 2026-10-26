// Envio de notificacoes de suporte para o webhook HTTPS configurado pelo usuario.
export async function sendSupportStatusWebhook(webhookUrl, payload) {
    const response = await fetch(webhookUrl, {
        method: 'POST',
        redirect: 'error',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    const gatewayRunId = response.headers.get('x-ms-workflow-run-id') || response.headers.get('x-ms-workflow-run-i') || null;
    const trackingId = response.headers.get('x-ms-igw-tracking-id') || null;
    const requestDate = response.headers.get('date') || null;

    if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Webhook falhou (${response.status}): ${body || response.statusText}`);
    }

    return {
        statusCode: response.status,
        runId: gatewayRunId,
        trackingId,
        requestDate
    };
}
