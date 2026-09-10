import * as boards from '../infrastructure/boards/index.js';
import * as ai from '../infrastructure/ai/index.js';

import { sendMessageToTab } from '../infrastructure/browser/runtimeMessaging.js';
import { getLocalStorage, setLocalStorage } from '../infrastructure/persistence/localStorage.js';
import { postProcessGeneratedScenarios, orchestrateScenarioGeneration, orchestrateScenarioAdaptation } from '../application/index.js';
import { DEFAULT_AI_PROVIDER, SUPPORTED_AI_PROVIDERS } from '../core/constants.js';

const azureGetWorkItem = boards.azureGetWorkItem;
const azureGetQaDashboard = boards.azureGetQaDashboard;
const azureGetTestCaseAnalytics = boards.azureGetTestCaseAnalytics;
const azureUpdateWorkItemsState = boards.azureUpdateWorkItemsState;
const azureCreateTestCase = boards.azureCreateTestCase;
const ensureScenarioParamsDefault = boards.ensureScenarioParamsDefault;
const isValidAzureAssignee = boards.isValidAzureAssignee;
const azureGetTestRunnerCards = boards.azureGetTestRunnerCards;
const azureGetTestCasesForWorkItem = boards.azureGetTestCasesForWorkItem;
const azureGetTestPointsForTestCases = boards.azureGetTestPointsForTestCases;
const azureCreateTestRun = boards.azureCreateTestRun;
const azureGetRunResults = boards.azureGetRunResults;
const azureAddAdhocTestResults = boards.azureAddAdhocTestResults;
const azureUpdateTestResult = boards.azureUpdateTestResult;
const azureCompleteTestRun = boards.azureCompleteTestRun;
const azureCreateBugFromFailure = boards.azureCreateBugFromFailure;
const azureAddAttachment = boards.azureAddAttachment;
const azureGetProjectIterations = boards.azureGetProjectIterations;
const azureGetDeployValidation = boards.azureGetDeployValidation;
const azureGetSupportCards = boards.azureGetSupportCards;
const jiraCreateTestCase = boards.jiraCreateTestCase;
const jiraGetIssue = boards.jiraGetIssue;

const evaluateCoverageGemini = ai.evaluateCoverageGemini;
const generateScenariosGemini = ai.generateScenariosGemini;
const fetchGeminiModels = ai.fetchGeminiModels;
const evaluateCoverageCopilot = ai.evaluateCoverageCopilot;
const generateScenariosCopilot = ai.generateScenariosCopilot;
const fetchCopilotModels = ai.fetchCopilotModels;
const evaluateCoverageGroq = ai.evaluateCoverageGroq;
const generateScenariosGroq = ai.generateScenariosGroq;
const fetchGroqModels = ai.fetchGroqModels;

const DEFAULT_COPILOT_BACKEND_URL = 'https://qualiflow-gerador-de-cts.onrender.com';
const SUPPORT_MONITOR_ALARM_NAME = 'qualiflow-support-status-monitor';
const SUPPORT_MONITOR_STORAGE_KEY = 'qualiflowSupportStatusMonitorStateV1';
const SUPPORT_MONITOR_INTERVAL_MINUTES = 5;

let supportMonitorRunning = false;

function normalizeCopilotBackendUrl(rawValue) {
    const value = String(rawValue || '').trim();
    if (!value) return DEFAULT_COPILOT_BACKEND_URL;

    try {
        const parsed = new URL(value);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            return DEFAULT_COPILOT_BACKEND_URL;
        }
        return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, '');
    } catch {
        return DEFAULT_COPILOT_BACKEND_URL;
    }
}

async function getCopilotBackendUrl() {
    const storage = await getLocalStorage(['copilotBackendUrl']);
    return normalizeCopilotBackendUrl(storage?.copilotBackendUrl);
}

function removeDiacritics(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeSupportStatus(value) {
    const normalized = removeDiacritics(value).trim().toUpperCase();
    if (normalized === 'NOVO') return 'NOVO';
    if (normalized === 'EM ANDAMENTO') return 'EM ANDAMENTO';
    if (normalized === 'DONE') return 'DONE';
    return normalized || 'NOVO';
}

function parseIdentityName(identity) {
    if (!identity) return 'cliente';
    if (typeof identity === 'string') {
        const clean = identity.replace(/<[^>]+>/g, '').trim();
        return clean || 'cliente';
    }
    return identity.displayName || identity.name || identity.uniqueName || 'cliente';
}

function parseIdentityEmail(identity) {
    if (!identity) return '';
    if (typeof identity === 'string') {
        const match = identity.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
        return match ? match[0] : '';
    }
    return identity.mailAddress || identity.uniqueName || '';
}

function getFirstName(fullName) {
    const clean = String(fullName || '').trim();
    if (!clean) return 'cliente';
    return clean.split(/\s+/)[0] || 'cliente';
}

function parseAndValidateWebhookUrl(rawUrl) {
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

function buildSupportStatusMessage({ firstName, supportId, title, oldStatus, newStatus }) {
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

function buildSupportAdaptiveCard({ message, supportId, title, oldStatus, newStatus, requesterName, url }) {
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

async function sendSupportStatusWebhook(webhookUrl, payload) {
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

async function executeSupportStatusMonitor(options = {}) {
    const forceNotifyNovo = options?.forceNotifyNovo === true;
    if (supportMonitorRunning) {
        return { skipped: true, reason: 'already-running' };
    }

    supportMonitorRunning = true;
    try {
        const settings = await getSettings();
        if (!settings?.azureSessionToken || !settings?.azureOrg || !settings?.azureProject) {
            return { skipped: true, reason: 'missing-azure-config' };
        }
        const webhookUrl = String(settings?.supportWebhookUrl || '').trim();
        if (!webhookUrl) {
            return { skipped: true, reason: 'missing-webhook-config' };
        }
        const webhookDestination = parseAndValidateWebhookUrl(webhookUrl);

        const supports = await azureGetSupportCards(settings);
        const monitorStateRaw = await getLocalStorage([SUPPORT_MONITOR_STORAGE_KEY]);
        const monitorState = monitorStateRaw?.[SUPPORT_MONITOR_STORAGE_KEY] || { initialized: false, snapshot: {} };
        const previousSnapshot = monitorState.snapshot || {};

        const nextSnapshot = {};
        supports.forEach((item) => {
            const id = String(item.id);
            nextSnapshot[id] = {
                state: normalizeSupportStatus(item.state),
                title: item.title || ''
            };
        });

        if (!monitorState.initialized) {
            let sentCount = 0;
            let failedCount = 0;
            const deliveries = [];

            for (const item of supports) {
                const status = normalizeSupportStatus(item.state);
                if (status !== 'NOVO') continue;

                const requesterName = parseIdentityName(item.requester);
                const requesterEmail = parseIdentityEmail(item.requester);
                const firstName = getFirstName(requesterName);

                const message = buildSupportStatusMessage({
                    firstName,
                    supportId: item.id,
                    title: item.title,
                    oldStatus: '',
                    newStatus: 'NOVO'
                });

                const payload = {
                    ...buildSupportAdaptiveCard({
                        message,
                        supportId: item.id,
                        title: item.title,
                        oldStatus: null,
                        newStatus: 'NOVO',
                        requesterName,
                        url: item.url
                    }),
                    qaSupportMeta: {
                        supportId: item.id,
                        supportTitle: item.title,
                        statusAnterior: null,
                        statusAtual: 'NOVO',
                        requesterName,
                        requesterEmail,
                        url: item.url,
                        timestamp: new Date().toISOString()
                    }
                };

                try {
                    const delivery = await sendSupportStatusWebhook(webhookUrl, payload);
                    sentCount += 1;
                    deliveries.push({
                        supportId: item.id,
                        statusAtual: 'NOVO',
                        statusCode: delivery?.statusCode || 0,
                        runId: delivery?.runId || null,
                        trackingId: delivery?.trackingId || null,
                        requestDate: delivery?.requestDate || null
                    });
                } catch (err) {
                    failedCount += 1;
                    console.error(`[QualiFlow] Falha ao enviar webhook do suporte ${item.id} na inicializacao:`, err);

                    // Remove do snapshot para tentar novamente no proximo ciclo.
                    delete nextSnapshot[String(item.id)];
                }
            }

            await setLocalStorage({
                [SUPPORT_MONITOR_STORAGE_KEY]: {
                    initialized: true,
                    snapshot: nextSnapshot,
                    lastRunAt: new Date().toISOString(),
                    lastTransitions: supports.filter((item) => normalizeSupportStatus(item.state) === 'NOVO').length,
                    lastSentCount: sentCount,
                    lastFailedCount: failedCount
                }
            });
            return {
                initialized: true,
                transitions: supports.filter((item) => normalizeSupportStatus(item.state) === 'NOVO').length,
                sentCount,
                failedCount,
                total: supports.length,
                deliveries,
                destination: webhookDestination
            };
        }

        const transitions = [];
        supports.forEach((item) => {
            const id = String(item.id);
            const newStatus = normalizeSupportStatus(item.state);
            const oldStatus = normalizeSupportStatus(previousSnapshot[id]?.state || '');

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

        let sentCount = 0;
        let failedCount = 0;
        const deliveries = [];
        for (const t of transitions) {
            const requesterName = parseIdentityName(t.item.requester);
            const requesterEmail = parseIdentityEmail(t.item.requester);
            const firstName = getFirstName(requesterName);

            const message = buildSupportStatusMessage({
                firstName,
                supportId: t.item.id,
                title: t.item.title,
                oldStatus: t.oldStatus,
                newStatus: t.newStatus
            });

            const payload = {
                ...buildSupportAdaptiveCard({
                    message,
                    supportId: t.item.id,
                    title: t.item.title,
                    oldStatus: t.oldStatus || null,
                    newStatus: t.newStatus,
                    requesterName,
                    url: t.item.url
                }),
                qaSupportMeta: {
                    supportId: t.item.id,
                    supportTitle: t.item.title,
                    statusAnterior: t.oldStatus || null,
                    statusAtual: t.newStatus,
                    requesterName,
                    requesterEmail,
                    url: t.item.url,
                    timestamp: new Date().toISOString()
                }
            };

            try {
                const delivery = await sendSupportStatusWebhook(webhookUrl, payload);
                sentCount += 1;
                deliveries.push({
                    supportId: t.item.id,
                    statusAnterior: t.oldStatus || null,
                    statusAtual: t.newStatus,
                    forced: t.forced === true,
                    statusCode: delivery?.statusCode || 0,
                    runId: delivery?.runId || null,
                    trackingId: delivery?.trackingId || null,
                    requestDate: delivery?.requestDate || null
                });
            } catch (err) {
                failedCount += 1;
                console.error(`[QualiFlow] Falha ao enviar webhook do suporte ${t.item.id}:`, err);

                if (t.oldStatus) {
                    nextSnapshot[t.id] = {
                        state: t.oldStatus,
                        title: t.item.title || ''
                    };
                } else {
                    delete nextSnapshot[t.id];
                }
            }
        }

        await setLocalStorage({
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
        supportMonitorRunning = false;
    }
}

function ensureSupportMonitorAlarm() {
    chrome.alarms.create(SUPPORT_MONITOR_ALARM_NAME, {
        periodInMinutes: SUPPORT_MONITOR_INTERVAL_MINUTES
    });
}

chrome.runtime.onInstalled.addListener(() => {
    ensureSupportMonitorAlarm();
    void executeSupportStatusMonitor();
});

chrome.runtime.onStartup.addListener(() => {
    ensureSupportMonitorAlarm();
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm?.name !== SUPPORT_MONITOR_ALARM_NAME) return;
    void executeSupportStatusMonitor();
});

ensureSupportMonitorAlarm();

async function parseJsonResponse(response) {
    const rawText = await response.text();
    try {
        return rawText ? JSON.parse(rawText) : {};
    } catch {
        const preview = rawText.replace(/\s+/g, ' ').trim().slice(0, 160);
        throw new Error(
            `Backend respondeu ${response.status} sem JSON valido (verifique se a URL do backend esta correta e se ele esta rodando/atualizado). ${preview}`
        );
    }
}

async function startCopilotOAuthSession(backendUrlHint) {
    const backendUrl = String(backendUrlHint || '').trim()
        ? normalizeCopilotBackendUrl(backendUrlHint)
        : await getCopilotBackendUrl();
    const response = await fetch(`${backendUrl}/auth/session/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    });
    const body = await parseJsonResponse(response);

    if (!response.ok || body?.success === false || !body?.requestId) {
        throw new Error(body?.error?.message || 'Falha ao iniciar autenticacao OAuth.');
    }

    const loginPath = String(body.loginPath || '/auth/github/login').trim() || '/auth/github/login';
    const loginUrl = new URL(loginPath, `${backendUrl}/`).toString();
    await chrome.tabs.create({ url: loginUrl });
    return {
        requestId: body.requestId,
        pollPath: body.pollPath,
        backendUrl
    };
}

async function startBoardOAuthSession(provider, backendUrlHint, jiraDomain) {
    const backendUrl = String(backendUrlHint || '').trim()
        ? normalizeCopilotBackendUrl(backendUrlHint)
        : await getCopilotBackendUrl();

    const response = await fetch(`${backendUrl}/auth/board/session/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, jiraDomain })
    });
    const body = await parseJsonResponse(response);

    if (!response.ok || body?.success === false || !body?.requestId) {
        throw new Error(body?.error?.message || 'Falha ao iniciar autenticacao OAuth.');
    }

    const loginUrl = new URL(body.loginPath, `${backendUrl}/`).toString();
    await chrome.tabs.create({ url: loginUrl });
    return { requestId: body.requestId, pollPath: body.pollPath, backendUrl };
}

async function pollBoardOAuthSession(provider, pollPath, backendUrlHint) {
    const backendUrl = String(backendUrlHint || '').trim()
        ? normalizeCopilotBackendUrl(backendUrlHint)
        : await getCopilotBackendUrl();
    const pollUrl = new URL(pollPath, `${backendUrl}/`).toString();
    const response = await fetch(pollUrl, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
    const body = await parseJsonResponse(response);

    if (body?.status === 'pending') {
        return { status: 'pending' };
    }

    if (!response.ok || body?.success === false) {
        throw new Error(body?.error?.message || 'Falha ao concluir login OAuth.');
    }

    if (body?.status === 'completed' && body?.sessionToken) {
        const storageKey = provider === 'jira' ? 'jiraSessionToken' : 'azureSessionToken';
        await setLocalStorage({ [storageKey]: body.sessionToken, copilotBackendUrl: backendUrl });
        return { status: 'completed', sessionToken: body.sessionToken, user: body.user || null, expiresAt: body.expiresAt || null };
    }

    return { status: 'pending' };
}

async function pollCopilotOAuthSession(pollPath, backendUrlHint) {
    const backendUrl = String(backendUrlHint || '').trim()
        ? normalizeCopilotBackendUrl(backendUrlHint)
        : await getCopilotBackendUrl();
    const pollUrl = new URL(pollPath, `${backendUrl}/`).toString();
    const response = await fetch(pollUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
    });
    const body = await parseJsonResponse(response);

    if (body?.status === 'pending') {
        return { status: 'pending' };
    }

    if (!response.ok || body?.success === false) {
        throw new Error(body?.error?.message || 'Falha ao concluir login OAuth.');
    }

    if (body?.status === 'completed' && body?.sessionToken) {
        await setLocalStorage({
            copilotToken: body.sessionToken,
            copilotSessionToken: body.sessionToken,
            copilotBackendUrl: backendUrl
        });

        return {
            status: 'completed',
            sessionToken: body.sessionToken,
            user: body.user || null,
            expiresAt: body.expiresAt || null
        };
    }

    return { status: 'pending' };
}

async function getSettings() {
    return getLocalStorage([
        'azureSessionToken', 'azureOrg', 'azureProject',
        'jiraSessionToken', 'jiraDomain', 'jiraProjectKey', 'jiraTestIssueType', 'jiraAcceptanceFieldId', 'jiraLinkType',
        'supportWebhookUrl',
        'geminiKey', 'geminiModel',
        'qaEmail', 'qaTag', 'runnerEnabled', 'selectedAi', 'selectedBoard',
        'copilotToken', 'copilotSessionToken', 'copilotBackendUrl', 'copilotModel',
        'groqKey', 'groqModel'
    ]);
}

function isRunnerDisabled(settings) {
    return settings?.runnerEnabled === false;
}

function normalizeSelectedAi(selectedAi) {
    return SUPPORTED_AI_PROVIDERS.includes(selectedAi) ? selectedAi : DEFAULT_AI_PROVIDER;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const sendGenerationProgress = (payload) => {
        const tabId = sender?.tab?.id;
        if (!tabId) return;
        sendMessageToTab(tabId, {
            action: 'GENERATION_PROGRESS',
            ...payload
        }).catch(() => {
            // Silencioso para nao quebrar fluxo quando aba nao aceita mensagem.
        });
    };

    if (request.action === "GET_DATA") {
        getSettings().then(settings => {
            const selectedAi = normalizeSelectedAi(settings.selectedAi);
            const provider = request.provider === 'jira' ? 'jira' : (settings.selectedBoard === 'jira' ? 'jira' : 'azure');
            const hasCopilotSession = !!(settings.copilotSessionToken || settings.copilotToken);
            const hasAiConfig = selectedAi === 'copilot' ? hasCopilotSession
                : selectedAi === 'groq' ? !!settings.groqKey
                    : !!settings.geminiKey;
            if (!hasAiConfig) {
                return sendResponse({ error: "Configurações ausentes. Por favor, configure a extensão primeiro." });
            }

            if (provider === 'jira') {
                if (!settings.jiraDomain || !settings.jiraSessionToken || !settings.jiraProjectKey) {
                    return sendResponse({ error: "Configuração Jira incompleta. Preencha domínio, email, token e project key." });
                }
            } else {
                if (!settings.azureSessionToken || !settings.azureOrg || !settings.azureProject) {
                    return sendResponse({ error: "Configuração Azure incompleta. Preencha PAT, organização e projeto." });
                }
            }

            const loader = provider === 'jira'
                ? jiraGetIssue(request.workId, settings)
                : azureGetWorkItem(request.workId, settings);

            loader
                .then(data => sendResponse({ data }))
                .catch(err => sendResponse({ error: err.message }));
        });
        return true; // Keep channel open
    }

    if (request.action === "GET_DASHBOARD_DATA") {
        getSettings().then(settings => {
            if (!settings.azureSessionToken || !settings.azureOrg || !settings.azureProject) {
                return sendResponse({ error: "Configurações ausentes. Por favor, configure a extensão primeiro." });
            }
            azureGetQaDashboard(settings)
                .then(data => sendResponse({ data }))
                .catch(err => sendResponse({ error: err.message }));
        });
        return true;
    }

    if (request.action === "GET_TEST_CASE_ANALYTICS") {
        getSettings().then(settings => {
            if (!settings.azureSessionToken || !settings.azureOrg || !settings.azureProject) {
                return sendResponse({ error: "Configurações ausentes. Por favor, configure a extensão primeiro." });
            }
            azureGetTestCaseAnalytics(settings)
                .then(data => sendResponse({ data }))
                .catch(err => sendResponse({ error: err.message }));
        });
        return true;
    }

    if (request.action === "GET_SUPPORT_CARDS") {
        getSettings().then(settings => {
            if (!settings.azureSessionToken || !settings.azureOrg || !settings.azureProject) {
                return sendResponse({ error: "Configuração incompleta do Azure." });
            }
            azureGetSupportCards(settings)
                .then(data => sendResponse({ data }))
                .catch(err => sendResponse({ error: err.message }));
        });
        return true;
    }

    if (request.action === "RUN_SUPPORT_MONITOR_NOW") {
        executeSupportStatusMonitor({ forceNotifyNovo: true })
            .then((result) => sendResponse({ ok: true, result }))
            .catch((err) => sendResponse({ ok: false, error: err.message }));
        return true;
    }

    if (request.action === "GET_PROJECT_ITERATIONS") {
        getSettings().then(settings => {
            if (!settings.azureSessionToken || !settings.azureOrg || !settings.azureProject) {
                return sendResponse({ error: "Configurações ausentes. Por favor, configure a extensão primeiro." });
            }
            azureGetProjectIterations(settings)
                .then(data => sendResponse({ data }))
                .catch(err => sendResponse({ error: err.message }));
        });
        return true;
    }

    if (request.action === "GET_DEPLOY_VALIDATION") {
        getSettings().then(settings => {
            if (!settings.azureSessionToken || !settings.azureOrg || !settings.azureProject) {
                return sendResponse({ error: "Configurações ausentes. Por favor, configure a extensão primeiro." });
            }
            if (!request.iterationPath) {
                return sendResponse({ error: "Selecione uma Sprint/Iteration." });
            }
            azureGetDeployValidation(settings, request.iterationPath)
                .then(data => sendResponse({ data }))
                .catch(err => sendResponse({ error: err.message }));
        });
        return true;
    }

    if (request.action === "GET_TEST_RUNNER_CARDS") {
        getSettings().then(settings => {
            if (isRunnerDisabled(settings)) {
                return sendResponse({ error: "Runner indisponível no momento." });
            }
            if (!settings.azureSessionToken || !settings.azureOrg || !settings.azureProject) {
                return sendResponse({ error: "Configuração incompleta do Azure." });
            }
            azureGetTestRunnerCards(settings, request.query)
                .then(data => sendResponse({ data }))
                .catch(err => sendResponse({ error: err.message }));
        });
        return true;
    }

    if (request.action === "GET_TEST_CASES_FOR_WORKITEM") {
        getSettings().then(settings => {
            if (isRunnerDisabled(settings)) {
                return sendResponse({ error: "Runner indisponível no momento." });
            }
            if (!settings.azureSessionToken || !settings.azureOrg || !settings.azureProject) {
                return sendResponse({ error: "Configuração incompleta do Azure." });
            }
            azureGetTestCasesForWorkItem(request.workItemId, settings)
                .then(data => sendResponse({ data }))
                .catch(err => sendResponse({ error: err.message }));
        });
        return true;
    }

    if (request.action === "GET_TEST_POINTS_FOR_TEST_CASES") {
        getSettings().then(settings => {
            if (isRunnerDisabled(settings)) {
                return sendResponse({ error: "Runner indisponível no momento." });
            }
            azureGetTestPointsForTestCases(request.testCaseIds, settings)
                .then(data => sendResponse({ data }))
                .catch(err => sendResponse({ error: err.message }));
        });
        return true;
    }

    if (request.action === "CREATE_TEST_RUN") {
        getSettings().then(settings => {
            if (isRunnerDisabled(settings)) {
                return sendResponse({ error: "Runner indisponível no momento." });
            }
            azureCreateTestRun(request.title, request.planId, request.pointIds, settings)
                .then(runId => sendResponse({ runId }))
                .catch(err => sendResponse({ error: err.message }));
        });
        return true;
    }

    if (request.action === "GET_RUN_RESULTS") {
        getSettings().then(settings => {
            if (isRunnerDisabled(settings)) {
                return sendResponse({ error: "Runner indisponível no momento." });
            }
            azureGetRunResults(request.runId, settings)
                .then(data => sendResponse({ data }))
                .catch(err => sendResponse({ error: err.message }));
        });
        return true;
    }

    if (request.action === "ADD_ADHOC_RESULTS") {
        getSettings().then(settings => {
            if (isRunnerDisabled(settings)) {
                return sendResponse({ error: "Runner indisponível no momento." });
            }
            azureAddAdhocTestResults(request.runId, request.testCaseIds, settings)
                .then(data => sendResponse({ data }))
                .catch(err => sendResponse({ error: err.message }));
        });
        return true;
    }

    if (request.action === "UPDATE_TEST_RESULT") {
        getSettings().then(settings => {
            if (isRunnerDisabled(settings)) {
                return sendResponse({ error: "Runner indisponível no momento." });
            }
            azureUpdateTestResult(request.runId, request.resultId, request.outcome, request.comment, request.stepResults, settings)
                .then(() => sendResponse({ success: true }))
                .catch(err => sendResponse({ error: err.message }));
        });
        return true;
    }

    if (request.action === "COMPLETE_TEST_RUN") {
        getSettings().then(settings => {
            if (isRunnerDisabled(settings)) {
                return sendResponse({ error: "Runner indisponível no momento." });
            }
            azureCompleteTestRun(request.runId, request.state, settings)
                .then(() => sendResponse({ success: true }))
                .catch(err => sendResponse({ error: err.message }));
        });
        return true;
    }

    if (request.action === "CREATE_BUG") {
        getSettings().then(settings => {
            if (isRunnerDisabled(settings)) {
                return sendResponse({ error: "Runner indisponível no momento." });
            }
            azureCreateBugFromFailure(request.title, request.comment, request.testCaseId, request.workItemId, settings)
                .then(bugId => sendResponse({ bugId }))
                .catch(err => sendResponse({ error: err.message }));
        });
        return true;
    }

    if (request.action === "EVALUATE_COVERAGE") {
        getSettings().then(settings => {
            const selectedAi = normalizeSelectedAi(settings.selectedAi);
            const evaluator = selectedAi === 'copilot' ? evaluateCoverageCopilot
                : selectedAi === 'groq' ? evaluateCoverageGroq
                    : evaluateCoverageGemini;
            evaluator(request.cardData, settings)
                .then(result => sendResponse({ result }))
                .catch(err => sendResponse({ error: err.message }));
        });
        return true;
    }

    if (request.action === "GENERATE_SCENARIOS") {
        sendGenerationProgress({ stage: 'start', message: 'Iniciando processo de geracao...' });
        getSettings().then(settings => {
            const selectedAi = normalizeSelectedAi(settings.selectedAi);
            const generator = selectedAi === 'copilot' ? generateScenariosCopilot
                : selectedAi === 'groq' ? generateScenariosGroq
                    : generateScenariosGemini;

            orchestrateScenarioGeneration({
                selectedAi,
                settings,
                cardData: request.cardData,
                userFocus: request.userFocus,
                technicalDetail: request.technicalDetail,
                generationSettings: request.generationSettings,
                onProgress: (progress) => sendGenerationProgress(progress)
            })
                .catch(() => {
                    sendGenerationProgress({ stage: 'fallback', message: 'Executando fluxo legado de geracao...' });
                    return generator(request.cardData, request.userFocus, request.technicalDetail, request.generationSettings, settings);
                })
                .then((rawScenarios) => {
                    sendGenerationProgress({ stage: 'postprocess', message: 'Consolidando cenarios e matriz localmente...' });
                    const scenarios = postProcessGeneratedScenarios(rawScenarios, request.cardData, ensureScenarioParamsDefault);
                    sendGenerationProgress({ stage: 'done', message: 'Cenarios prontos para revisao.' });
                    sendResponse({ scenarios });
                })
                .catch(err => {
                    sendGenerationProgress({ stage: 'error', message: `Erro: ${err.message}` });
                    sendResponse({ error: err.message });
                });
        });
        return true;
    }

    if (request.action === "ADAPT_COPIED_SCENARIOS") {
        sendGenerationProgress({ stage: 'start', message: 'Iniciando ajustes automáticos dos CTs copiados...' });
        getSettings().then(settings => {
            const selectedAi = normalizeSelectedAi(settings.selectedAi);

            orchestrateScenarioAdaptation({
                selectedAi,
                settings,
                targetCardData: request.targetCardData,
                sourceWorkItem: {
                    id: request.copyContext?.sourceWorkItemId,
                    title: request.copyContext?.sourceWorkItemTitle
                },
                copiedScenarios: request.copiedScenarios || [],
                userFocus: request.userFocus,
                technicalDetail: request.technicalDetail,
                generationSettings: request.generationSettings,
                onProgress: (progress) => sendGenerationProgress(progress)
            })
                .then((rawScenarios) => {
                    sendGenerationProgress({ stage: 'postprocess', message: 'Consolidando cenários ajustados e RTM...' });
                    const scenarios = postProcessGeneratedScenarios(rawScenarios, request.targetCardData, ensureScenarioParamsDefault);
                    sendGenerationProgress({ stage: 'done', message: 'Ajustes automáticos concluídos.' });
                    sendResponse({ scenarios });
                })
                .catch(err => {
                    sendGenerationProgress({ stage: 'error', message: `Erro: ${err.message}` });
                    sendResponse({ error: err.message });
                });
        });
        return true;
    }

    if (request.action === "GET_GROQ_MODELS") {
        getSettings().then(settings => {
            fetchGroqModels(settings)
                .then(models => sendResponse({ models }))
                .catch(err => sendResponse({ error: err.message }));
        });
        return true;
    }

    if (request.action === "GET_GEMINI_MODELS") {
        getSettings().then(settings => {
            fetchGeminiModels(settings)
                .then(models => sendResponse({ models }))
                .catch(err => sendResponse({ error: err.message }));
        });
        return true;
    }

    if (request.action === "GET_COPILOT_MODELS") {
        getSettings().then(settings => {
            fetchCopilotModels(settings)
                .then(models => sendResponse({ models }))
                .catch(err => sendResponse({ error: err.message }));
        });
        return true;
    }

    if (request.action === "COPILOT_AUTH_START") {
        startCopilotOAuthSession(request.backendUrl)
            .then((data) => sendResponse({ success: true, ...data }))
            .catch((err) => sendResponse({ success: false, error: err.message }));
        return true;
    }

    if (request.action === "COPILOT_AUTH_POLL") {
        const pollPath = (request.pollPath || '').trim();
        if (!pollPath) {
            sendResponse({ success: false, error: 'pollPath nao informado.' });
            return false;
        }

        pollCopilotOAuthSession(pollPath, request.backendUrl)
            .then((data) => sendResponse({ success: true, ...data }))
            .catch((err) => sendResponse({ success: false, error: err.message }));
        return true;
    }

    if (request.action === "AZURE_AUTH_START" || request.action === "JIRA_AUTH_START") {
        const provider = request.action === "JIRA_AUTH_START" ? "atlassian" : "microsoft";
        startBoardOAuthSession(provider, request.backendUrl, request.jiraDomain)
            .then((data) => sendResponse({ success: true, ...data }))
            .catch((err) => sendResponse({ success: false, error: err.message }));
        return true;
    }

    if (request.action === "AZURE_AUTH_POLL" || request.action === "JIRA_AUTH_POLL") {
        const provider = request.action === "JIRA_AUTH_POLL" ? "jira" : "azure";
        const pollPath = (request.pollPath || '').trim();
        if (!pollPath) {
            sendResponse({ success: false, error: 'pollPath nao informado.' });
            return false;
        }

        pollBoardOAuthSession(provider, pollPath, request.backendUrl)
            .then((data) => sendResponse({ success: true, ...data }))
            .catch((err) => sendResponse({ success: false, error: err.message }));
        return true;
    }

    if (request.action === "UPDATE_WORK_ITEMS_STATE") {
        getSettings().then(settings => {
            azureUpdateWorkItemsState(request.ids, request.newState, settings)
                .then(result => sendResponse(result))
                .catch(err => sendResponse({ error: err.message }));
        });
        return true;
    }

    if (request.action === "SAVE_SCENARIOS") {
        getSettings().then(async settings => {
            const provider = request.provider === 'jira' ? 'jira' : (settings.selectedBoard === 'jira' ? 'jira' : 'azure');

            if (provider === 'jira') {
                try {
                    if (!settings.jiraDomain || !settings.jiraSessionToken || !settings.jiraProjectKey) {
                        throw new Error('Configuração Jira incompleta. Verifique domínio, email, token e project key.');
                    }
                    if (!request.parentData?.id) {
                        throw new Error('Issue pai Jira não identificada para vincular os testes.');
                    }

                    const results = [];
                    for (const item of request.scenarios) {
                        ensureScenarioParamsDefault(item);
                        const res = await jiraCreateTestCase(item, settings, request.parentData?.id);
                        results.push({
                            id: res.id,
                            key: res.key,
                            title: item.title,
                            action: 'created',
                            status: 'success'
                        });
                    }

                    sendResponse({
                        success: true,
                        results,
                        message: `${results.length} testes criados com sucesso no Jira.`
                    });
                } catch (err) {
                    sendResponse({
                        success: false,
                        error: err.message
                    });
                }
                return;
            }

            let results = [];
            let errors = [];

            const qaEmail = settings.qaEmail?.trim();
            const defaultAssignee = isValidAzureAssignee(qaEmail) ? qaEmail : undefined;
            if (qaEmail && !defaultAssignee) {
                console.warn(`QA email configurado não é um valor Azure válido: ${qaEmail}`);
            }

            // Build map of existing test IDs for validation
            const existingTestIds = request.parentData?.existing_tests?.map(t => t.id) || [];

            for (let idx = 0; idx < request.scenarios.length; idx++) {
                const item = request.scenarios[idx];
                try {
                    const assigneeTrimmed = item.assignedTo?.trim();
                    if (!assigneeTrimmed || !isValidAzureAssignee(assigneeTrimmed)) {
                        if (defaultAssignee) {
                            item.assignedTo = defaultAssignee;
                        } else {
                            delete item.assignedTo;
                        }
                    } else {
                        item.assignedTo = assigneeTrimmed;
                    }
                    // Ensure every detected parameter has a default value before saving
                    ensureScenarioParamsDefault(item);

                    // CRITICAL FIX: id_original should never exist (schema removed it)
                    // But if for some reason it exists, validate it against existing tests
                    if (item.id_original) {
                        if (!existingTestIds.includes(item.id_original)) {
                            throw new Error(
                                `ID ${item.id_original} não encontrado nos testes vinculados. ` +
                                `IDs válidos: [${existingTestIds.join(', ')}]. ` +
                                `Pode ser um erro do Gemini. Nenhum teste foi criado. ` +
                                `Refreshe a página e tente novamente.`
                            );
                        }
                        // Even if ID is valid, warn and skip (we only want to create new tests)
                        console.warn(`Aviso: Ignoring id_original ${item.id_original} for test "${item.title}" (criando novo teste).`);
                        item.id_original = undefined;
                    }

                    // Always create new test case
                    const res = await azureCreateTestCase(item, settings, request.parentData);
                    results.push({
                        id: res.id,
                        title: item.title,
                        action: 'created',
                        status: 'success'
                    });
                } catch (err) {
                    // Capture error per item, don't break loop
                    const errorMsg = err instanceof Error ? err.message : String(err);
                    const testLabel = item.title || `Cenário ${idx + 1}`;
                    errors.push({
                        testTitle: testLabel,
                        error: errorMsg,
                        index: idx
                    });
                    results.push({
                        title: testLabel,
                        action: 'failed',
                        status: 'error',
                        error: errorMsg
                    });
                }
            }

            if (errors.length > 0) {
                const errorDetails = errors.map(
                    e => `  - "${e.testTitle}" (índice ${e.index}): ${e.error}`
                ).join('\n');
                sendResponse({
                    success: false,
                    results,
                    error: `${errors.length}/${request.scenarios.length} testes falharam:\n${errorDetails}\n\nSe PAT/permissões estiverem OK, entre em contato com o suporte.`,
                    partialSuccess: results.filter(r => r.status === 'success').length > 0
                });
            } else {
                sendResponse({
                    success: true,
                    results,
                    message: `${results.length} testes criados com sucesso no Azure DevOps.`
                });
            }
        });
        return true;
    }

    if (request.action === 'CAPTURE_SCREENSHOT') {
        // Capture visible tab from background context (content scripts cannot do this)
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tabId = tabs[0]?.id;
            if (!tabId) return sendResponse({ error: 'Nenhuma aba ativa.' });
            chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
                if (chrome.runtime.lastError) {
                    sendResponse({ error: chrome.runtime.lastError.message });
                } else {
                    sendResponse({ dataUrl });
                }
            });
        });
        return true;
    }

    if (request.action === 'ADD_ATTACHMENT') {
        getSettings().then(async settings => {
            try {
                const result = await azureAddAttachment(
                    request.runId,
                    request.resultId,
                    request.fileName,
                    request.base64Content,
                    request.comment || '',
                    settings
                );
                sendResponse({ ok: true, result });
            } catch (err) {
                sendResponse({ error: err.message });
            }
        });
        return true;
    }
});
