import { hasAzureConfig } from '../domain/settingsRules.js';
import {
    buildSupportSnapshot,
    buildSupportWebhookPayload,
    computeInitialSupportTransitions,
    computeSupportTransitions,
    parseAndValidateWebhookUrl,
    rollbackSnapshotEntry
} from '../domain/supportNotification.js';

export const SUPPORT_MONITOR_STORAGE_KEY = 'qualiflowSupportStatusMonitorStateV1';

// Monitor de chamados de suporte: compara o status atual com o ultimo snapshot e notifica o
// webhook configurado a cada transicao. Cria um monitor com guarda contra execucoes concorrentes.
export function createSupportMonitor({ getSettings, storage, azure, sendWebhook }) {
    let running = false;

    function formatDelivery(t, delivery, isInitialRun) {
        const base = {
            supportId: t.item.id,
            ...(isInitialRun
                ? { statusAtual: 'NOVO' }
                : { statusAnterior: t.oldStatus || null, statusAtual: t.newStatus, forced: t.forced === true }),
            statusCode: delivery?.statusCode || 0,
            runId: delivery?.runId || null,
            trackingId: delivery?.trackingId || null,
            requestDate: delivery?.requestDate || null
        };
        return base;
    }

    async function deliver(transitions, webhookUrl, nextSnapshot, isInitialRun) {
        let sentCount = 0;
        let failedCount = 0;
        const deliveries = [];

        for (const t of transitions) {
            const payload = buildSupportWebhookPayload(t.item, {
                oldStatus: t.oldStatus,
                newStatus: t.newStatus,
                timestamp: new Date().toISOString()
            });

            try {
                const delivery = await sendWebhook(webhookUrl, payload);
                sentCount += 1;
                deliveries.push(formatDelivery(t, delivery, isInitialRun));
            } catch (err) {
                failedCount += 1;
                const where = isInitialRun ? `${t.item.id} na inicializacao` : `${t.item.id}`;
                console.error(`[QualiFlow] Falha ao enviar webhook do suporte ${where}:`, err);
                // Reverte o snapshot para tentar novamente no proximo ciclo.
                rollbackSnapshotEntry(nextSnapshot, t);
            }
        }

        return { sentCount, failedCount, deliveries };
    }

    async function run(options = {}) {
        const forceNotifyNovo = options?.forceNotifyNovo === true;
        if (running) {
            return { skipped: true, reason: 'already-running' };
        }

        running = true;
        try {
            const settings = await getSettings();
            if (!hasAzureConfig(settings)) {
                return { skipped: true, reason: 'missing-azure-config' };
            }
            const webhookUrl = String(settings?.supportWebhookUrl || '').trim();
            if (!webhookUrl) {
                return { skipped: true, reason: 'missing-webhook-config' };
            }
            const webhookDestination = parseAndValidateWebhookUrl(webhookUrl);

            const supports = await azure.azureGetSupportCards(settings);
            const monitorStateRaw = await storage.get([SUPPORT_MONITOR_STORAGE_KEY]);
            const monitorState = monitorStateRaw?.[SUPPORT_MONITOR_STORAGE_KEY] || { initialized: false, snapshot: {} };
            const previousSnapshot = monitorState.snapshot || {};

            const nextSnapshot = buildSupportSnapshot(supports);
            const isInitialRun = !monitorState.initialized;
            const transitions = isInitialRun
                ? computeInitialSupportTransitions(supports)
                : computeSupportTransitions(supports, previousSnapshot, { forceNotifyNovo });

            const { sentCount, failedCount, deliveries } = await deliver(transitions, webhookUrl, nextSnapshot, isInitialRun);

            await storage.set({
                [SUPPORT_MONITOR_STORAGE_KEY]: {
                    initialized: true,
                    snapshot: nextSnapshot,
                    lastRunAt: new Date().toISOString(),
                    lastTransitions: transitions.length,
                    lastSentCount: sentCount,
                    lastFailedCount: failedCount
                }
            });

            return {
                ...(isInitialRun ? { initialized: true } : {}),
                transitions: transitions.length,
                sentCount,
                failedCount,
                total: supports.length,
                deliveries,
                destination: webhookDestination
            };
        } catch (err) {
            console.error('[QualiFlow] Erro no monitor de suportes:', err);
            return { error: err.message || String(err) };
        } finally {
            running = false;
        }
    }

    return { run };
}

