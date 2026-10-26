// Regras puras do monitor de status de chamados de suporte: normalizacao de status,
// identidade do solicitante, mensagens, Adaptive Card e calculo das transicoes a notificar.

function removeDiacritics(value) {
    return String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function normalizeSupportStatus(value) {
    const normalized = removeDiacritics(value).trim().toUpperCase();
    if (normalized === 'NOVO') return 'NOVO';
    if (normalized === 'EM ANDAMENTO') return 'EM ANDAMENTO';
    if (normalized === 'DONE') return 'DONE';
    return normalized || 'NOVO';
}

export function parseIdentityName(identity) {
    if (!identity) return 'cliente';
    if (typeof identity === 'string') {
        const clean = identity.replace(/<[^>]+>/g, '').trim();
        return clean || 'cliente';
    }
    return identity.displayName || identity.name || identity.uniqueName || 'cliente';
}

export function parseIdentityEmail(identity) {
    if (!identity) return '';
    if (typeof identity === 'string') {
        const match = identity.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
        return match ? match[0] : '';
    }
    return identity.mailAddress || identity.uniqueName || '';
}

export function getFirstName(fullName) {
    const clean = String(fullName || '').trim();
    if (!clean) return 'cliente';
    return clean.split(/\s+/)[0] || 'cliente';
}

export function parseAndValidateWebhookUrl(rawUrl) {
    const value = String(rawUrl || '').trim();
    if (!value) {
        throw new Error('Webhook de suporte nao configurado.');
    }

    let url;
    try {
        url = new URL(value);
    } catch {
        throw new Error('Webhook de suporte invalido (URL mal formatada).');
    }

    if (url.protocol !== 'https:') {
        throw new Error('Webhook de suporte deve usar HTTPS.');
    }

    return {
        raw: value,
        host: url.host,
        pathname: url.pathname
    };
}

export function buildSupportStatusMessage({ firstName, supportId, title, oldStatus, newStatus }) {
    const safeFirstName = firstName || 'cliente';
    const safeTitle = title || 'chamado de sustentacao';

    if (newStatus === 'NOVO') {
        return `Ola ${safeFirstName}, seu chamado #${supportId} (${safeTitle}) foi recebido pelo nosso time. Voce recebera novas informacoes por este canal referente ao andamento do caso.`;
    }

    if (newStatus === 'EM ANDAMENTO') {
        if (oldStatus === 'NOVO') {
            return `Ola ${safeFirstName}, seu chamado #${supportId} (${safeTitle}) esta em andamento. Nosso time ja iniciou a analise e seguiremos atualizando voce por este canal.`;
        }
        return `Ola ${safeFirstName}, seu chamado #${supportId} (${safeTitle}) segue em andamento pelo nosso time. Novas atualizacoes serao enviadas por este canal.`;
    }

    if (newStatus === 'DONE') {
        return `Ola ${safeFirstName}, seu chamado #${supportId} (${safeTitle}) foi concluido pelo nosso time. Caso precise de novos ajustes, ficamos a disposicao.`;
    }

    return `Ola ${safeFirstName}, seu chamado #${supportId} (${safeTitle}) teve atualizacao de status para ${newStatus}. Seguiremos com novas informacoes por este canal.`;
}

export function buildSupportAdaptiveCard({ message, supportId, title, oldStatus, newStatus, requesterName, url }) {
    const safeMessage = String(message || '').trim();
    const safeTitle = String(title || 'Chamado de sustentacao').trim();
    const safeUrl = String(url || '').trim();
    const safeRequester = String(requesterName || 'cliente').trim();

    return {
        type: 'AdaptiveCard',
        $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
        version: '1.4',
        body: [
            {
                type: 'TextBlock',
                text: `Suporte #${supportId}`,
                weight: 'Bolder',
                size: 'Medium',
                wrap: true
            },
            {
                type: 'TextBlock',
                text: safeTitle,
                wrap: true,
                spacing: 'Small'
            },
            {
                type: 'TextBlock',
                text: safeMessage,
                wrap: true,
                spacing: 'Medium'
            },
            {
                type: 'FactSet',
                spacing: 'Medium',
                facts: [
                    { title: 'Status anterior', value: String(oldStatus || '-').trim() || '-' },
                    { title: 'Status atual', value: String(newStatus || '-').trim() || '-' },
                    { title: 'Solicitante', value: safeRequester || '-' }
                ]
            }
        ],
        actions: safeUrl ? [
            {
                type: 'Action.OpenUrl',
                title: 'Abrir chamado no Azure',
                url: safeUrl
            }
        ] : []
    };
}

// Monta o payload enviado ao webhook (Adaptive Card + metadados para o fluxo do destino).
export function buildSupportWebhookPayload(item, { oldStatus, newStatus, timestamp }) {
    const requesterName = parseIdentityName(item.requester);
    const requesterEmail = parseIdentityEmail(item.requester);
    const firstName = getFirstName(requesterName);

    const message = buildSupportStatusMessage({
        firstName,
        supportId: item.id,
        title: item.title,
        oldStatus,
        newStatus
    });

    return {
        ...buildSupportAdaptiveCard({
            message,
            supportId: item.id,
            title: item.title,
            oldStatus: oldStatus || null,
            newStatus,
            requesterName,
            url: item.url
        }),
        qaSupportMeta: {
            supportId: item.id,
            supportTitle: item.title,
            statusAnterior: oldStatus || null,
            statusAtual: newStatus,
            requesterName,
            requesterEmail,
            url: item.url,
            timestamp
        }
    };
}

export function buildSupportSnapshot(supports) {
    const snapshot = {};
    supports.forEach((item) => {
        snapshot[String(item.id)] = {
            state: normalizeSupportStatus(item.state),
            title: item.title || ''
        };
    });
    return snapshot;
}

// Primeira execucao: notifica apenas chamados NOVO.
export function computeInitialSupportTransitions(supports) {
    const transitions = [];
    for (const item of supports) {
        const newStatus = normalizeSupportStatus(item.state);
        if (newStatus !== 'NOVO') continue;
        transitions.push({ id: String(item.id), item, oldStatus: '', newStatus });
    }
    return transitions;
}

// Execucoes seguintes: compara com o snapshot anterior (card novo => oldStatus vazio).
export function computeSupportTransitions(supports, previousSnapshot, { forceNotifyNovo = false } = {}) {
    const transitions = [];
    supports.forEach((item) => {
        const id = String(item.id);
        const newStatus = normalizeSupportStatus(item.state);
        // Card novo (fora do snapshot) fica com oldStatus vazio; normalizeSupportStatus('')
        // devolveria 'NOVO' e o card nunca seria notificado.
        const oldStatus = previousSnapshot[id] ? normalizeSupportStatus(previousSnapshot[id].state) : '';

        if (!oldStatus) {
            transitions.push({ id, item, oldStatus: '', newStatus });
            return;
        }

        if (oldStatus !== newStatus) {
            transitions.push({ id, item, oldStatus, newStatus });
            return;
        }

        if (forceNotifyNovo && newStatus === 'NOVO') {
            transitions.push({ id, item, oldStatus, newStatus, forced: true });
        }
    });
    return transitions;
}

// Apos falha de envio: volta o snapshot ao estado anterior para tentar de novo no proximo ciclo.
export function rollbackSnapshotEntry(snapshot, transition) {
    if (transition.oldStatus) {
        snapshot[transition.id] = {
            state: transition.oldStatus,
            title: transition.item.title || ''
        };
    } else {
        delete snapshot[transition.id];
    }
}
