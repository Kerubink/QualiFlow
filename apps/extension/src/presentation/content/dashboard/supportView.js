import { sendRuntimeMessage } from '../shared/runtime.js';
import { dashboardState } from './state.js';
import { escapeHtml, getDashboardTypeStyle, getIterationLabel } from './helpers.js';
import { initMultiSelectDropdown } from './multiSelectDropdown.js';
import { RuntimeActions } from '../../../contracts/runtimeActions.js';

let supportDropdownDisposers = [];

export function renderSupportCards(data) {
    supportDropdownDisposers.forEach((dispose) => {
        try {
            dispose();
        } catch (_err) {
            // noop
        }
    });
    supportDropdownDisposers = [];

    dashboardState.supportCards = data || [];
    const container = document.getElementById('qualiflow-dashboard-support');
    if (!container) return;

    container.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'qualiflow-dashboard-header qualiflow-dsh-section';
    header.innerHTML = `
        <div class="qualiflow-dsh-head qualiflow-dsh-head-center">
            <h3 class="qualiflow-dsh-title">Suportes (Tipo Sustentação)</h3>
            <button id="qualiflow-support-test-notification" type="button" class="qualiflow-btn-inline qualiflow-btn-secondary qualiflow-btn-sm">Testar Notificação Agora</button>
        </div>
        <div id="qualiflow-support-test-feedback" class="qualiflow-dsh-feedback" aria-live="polite"></div>
    `;
    container.appendChild(header);

    const testBtn = document.getElementById('qualiflow-support-test-notification');
    const testFeedback = document.getElementById('qualiflow-support-test-feedback');
    if (testBtn && testFeedback) {
        const setFeedbackKind = (kind) => {
            testFeedback.classList.toggle('is-error', kind === 'error');
            testFeedback.classList.toggle('is-warning', kind === 'warning');
            testFeedback.classList.toggle('is-success', kind === 'success');
        };
        testBtn.addEventListener('click', () => {
            testBtn.disabled = true;
            testBtn.textContent = 'Executando...';
            setFeedbackKind('');
            testFeedback.textContent = 'Disparando monitor manual...';

            sendRuntimeMessage({ action: RuntimeActions.RUN_SUPPORT_MONITOR_NOW }, (response) => {
                testBtn.disabled = false;
                testBtn.textContent = 'Testar Notificação Agora';

                if (response?.error || response?.ok === false) {
                    setFeedbackKind('error');
                    testFeedback.textContent = `Erro: ${response?.error || 'falha ao executar monitor'}`;
                    return;
                }

                const result = response?.result || {};
                if (result.skipped) {
                    setFeedbackKind('warning');
                    if (result.reason === 'missing-webhook-config') {
                        testFeedback.textContent = 'Webhook não configurado. Vá em Opções > Geral e informe a URL do webhook.';
                    } else if (result.reason === 'missing-azure-config') {
                        testFeedback.textContent = 'Configuração do Azure incompleta para monitoramento.';
                    } else {
                        testFeedback.textContent = `Monitor não executado (${result.reason}).`;
                    }
                    return;
                }

                if (result.error) {
                    setFeedbackKind('error');
                    testFeedback.textContent = `Erro no monitor: ${result.error}`;
                    return;
                }

                setFeedbackKind('success');
                const deliveries = Array.isArray(result.deliveries) ? result.deliveries : [];
                const destination = result?.destination;
                const deliveryHints = deliveries
                    .slice(0, 3)
                    .map((d) => {
                        const run = d?.runId ? `runId ${d.runId}` : 'runId n/a';
                        const tracking = d?.trackingId ? `tracking ${d.trackingId}` : 'tracking n/a';
                        return `#${d.supportId}: ${run}, ${tracking}`;
                    })
                    .join(' | ');

                const destinationHint = destination?.host
                    ? ` Destino: ${destination.host}${destination.pathname || ''}.`
                    : '';

                const suffix = deliveryHints ? ` Detalhes: ${deliveryHints}.` : '';
                testFeedback.textContent = `Monitor executado. Transições: ${result.transitions || 0}, notificações enviadas: ${result.sentCount || 0}, falhas: ${result.failedCount || 0}.${destinationHint}${suffix}`;
            });
        });
    }

    if (dashboardState.supportCards.length === 0) {
        container.innerHTML += '<div class="qualiflow-empty" role="status">Nenhum card de Sustentação encontrado no board.</div>';
        return;
    }

    const getAssigneeLabel = (assignedTo) => {
        if (!assignedTo) return 'Não atribuído';
        if (typeof assignedTo === 'string') return assignedTo.trim() || 'Não atribuído';
        return (
            assignedTo.displayName ||
            assignedTo.uniqueName ||
            assignedTo.name ||
            'Não atribuído'
        );
    };

    const parseTags = (tags) => {
        return String(tags || '')
            .split(';')
            .map((t) => t.trim())
            .filter(Boolean);
    };

    const states = [...new Set(dashboardState.supportCards
        .map((wi) => String(wi.state || '').trim())
        .filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));

    const tags = [...new Set(dashboardState.supportCards
        .flatMap((wi) => parseTags(wi.tags)))].sort((a, b) => a.localeCompare(b, 'pt-BR'));

    const owners = [...new Set(dashboardState.supportCards
        .map((wi) => getAssigneeLabel(wi.assignedTo))
        .filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));

    const filters = document.createElement('div');
    filters.className = 'qualiflow-dsh-filters';
    filters.innerHTML = `
        <div class="qualiflow-select-group">
            <label for="qualiflow-support-filter-state">Estado</label>
            <select id="qualiflow-support-filter-state" class="qualiflow-select-input">
                <option value="">Todos os estados</option>
                ${states.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('')}
            </select>
        </div>
        <div class="qualiflow-select-group">
            <label for="qualiflow-support-filter-tag">Tag</label>
            <div id="qualiflow-support-filter-tag" class="qualiflow-multi-select">
                <button type="button" class="qualiflow-select-input qualiflow-multi-select-trigger" title="Selecione as tags" aria-label="Filtrar por tags">
                    <span class="qualiflow-multi-select-label">Tag: Todas</span>
                    <span class="qualiflow-multi-select-arrow">▼</span>
                </button>
                <div class="qualiflow-multi-select-panel"></div>
            </div>
        </div>
        <div class="qualiflow-select-group">
            <label for="qualiflow-support-filter-owner">Responsável</label>
            <select id="qualiflow-support-filter-owner" class="qualiflow-select-input">
                <option value="">Todos os responsáveis</option>
                ${owners.map((o) => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join('')}
            </select>
        </div>
    `;
    container.appendChild(filters);

    const info = document.createElement('div');
    info.id = 'qualiflow-support-filter-info';
    info.className = 'qualiflow-dsh-note';
    info.setAttribute('aria-live', 'polite');
    container.appendChild(info);

    const list = document.createElement('div');
    list.id = 'qualiflow-support-cards-list';
    list.className = 'qualiflow-dsh-grid';
    container.appendChild(list);

    const stateSelect = document.getElementById('qualiflow-support-filter-state');
    const tagSelect = document.getElementById('qualiflow-support-filter-tag');
    const ownerSelect = document.getElementById('qualiflow-support-filter-owner');
    const tagMulti = initMultiSelectDropdown(tagSelect, {
        placeholder: 'Tag',
        onChange: () => drawSupportCards()
    });
    if (tagMulti?.destroy) supportDropdownDisposers.push(tagMulti.destroy);
    if (tagMulti) tagMulti.setOptions(tags);

    const norm = (v) => String(v || '').trim().toLowerCase();

    const drawSupportCards = () => {
        const selectedState = stateSelect?.value || '';
        const selectedTags = tagMulti?.getSelectedValues?.() || [];
        const selectedOwner = ownerSelect?.value || '';

        const filtered = dashboardState.supportCards.filter((wi) => {
            const assignee = getAssigneeLabel(wi.assignedTo);
            const wiTags = parseTags(wi.tags);

            if (selectedState && norm(wi.state) !== norm(selectedState)) return false;
            if (selectedTags.length > 0) {
                const selectedNormalized = selectedTags.map(norm);
                if (!wiTags.some((t) => selectedNormalized.includes(norm(t)))) return false;
            }
            if (selectedOwner && norm(assignee) !== norm(selectedOwner)) return false;
            return true;
        });

        info.textContent = `${filtered.length} item(ns) exibido(s) de ${dashboardState.supportCards.length}.`;
        list.innerHTML = '';

        if (filtered.length === 0) {
            list.innerHTML = '<p class="qualiflow-dsh-empty-text" role="status">Nenhum card encontrado com os filtros selecionados.</p>';
            return;
        }

        filtered.forEach((wi) => {
            const card = document.createElement('div');
            card.className = 'qualiflow-card qualiflow-dsh-item';

            const typeStyle = getDashboardTypeStyle(wi.type);
            const assignee = getAssigneeLabel(wi.assignedTo);
            const wiTags = parseTags(wi.tags);
            const tagText = wiTags.length > 0 ? wiTags.join(', ') : 'Sem tag';

            card.innerHTML = `
                <div>
                    <div class="qualiflow-dsh-item-title">#${escapeHtml(wi.id)} - ${escapeHtml(wi.title)}</div>
                    <div class="qualiflow-dsh-item-meta">
                        <div class="qualiflow-dsh-item-row">
                            <span class="qualiflow-badge qualiflow-badge-${typeStyle.variant}">
                                ${typeStyle.icon} ${escapeHtml(wi.type)}
                            </span>
                            <span>${escapeHtml(wi.state)}</span>
                        </div>
                        <div><strong>Responsável:</strong> ${escapeHtml(assignee)}</div>
                        <div title="${escapeHtml(tagText)}"><strong>Tags:</strong> ${escapeHtml(tagText)}</div>
                        <div title="${escapeHtml(wi.iterationPath || 'Desconhecido')}"><strong>Sprint:</strong> ${escapeHtml(getIterationLabel(wi.iterationPath))}</div>
                    </div>
                </div>
                <div class="qualiflow-dsh-item-actions">
                    <a href="${escapeHtml(wi.url)}" class="qualiflow-btn-inline qualiflow-btn-primary qualiflow-btn-sm">Abrir</a>
                </div>
            `;

            list.appendChild(card);
        });
    };

    stateSelect?.addEventListener('change', drawSupportCards);
    ownerSelect?.addEventListener('change', drawSupportCards);

    drawSupportCards();
}

export function loadSupportCards() {
    const container = document.getElementById('qualiflow-dashboard-support');
    if (!container) return;
    container.innerHTML = '<div class="qualiflow-loading" role="status" aria-live="polite">Carregando cards de sustentação...</div>';

    sendRuntimeMessage({ action: RuntimeActions.GET_SUPPORT_CARDS }, (response) => {
        if (response && response.error) {
            container.innerHTML = `<div class="qualiflow-error-box" role="alert">Erro: ${escapeHtml(response.error)}</div>`;
            return;
        }
        renderSupportCards(response?.data || []);
    });
}
