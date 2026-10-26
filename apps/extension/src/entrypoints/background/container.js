// Composition root do service worker: liga as portas da camada de aplicacao aos adaptadores
// reais de infrastructure. E o unico lugar do background que conhece implementacoes concretas.
import * as azure from '../../infrastructure/boards/azure.js';
import * as jira from '../../infrastructure/boards/jira.js';
import * as gemini from '../../infrastructure/ai/gemini.js';
import * as groq from '../../infrastructure/ai/groq.js';
import * as copilot from '../../infrastructure/ai/copilot.js';
import * as scenarioGateway from '../../infrastructure/ai/scenarioGateway.js';
import * as authClient from '../../infrastructure/backend/authClient.js';
import { sendSupportStatusWebhook } from '../../infrastructure/backend/supportWebhook.js';
import { sendMessageToTab } from '../../infrastructure/browser/runtimeMessaging.js';
import { getLocalStorage, setLocalStorage } from '../../infrastructure/browser/storage.js';
import { captureActiveTab, openTab } from '../../infrastructure/browser/tabs.js';
import { getSettings, saveSettings } from '../../infrastructure/persistence/settingsRepository.js';
import { createSupportMonitor } from '../../application/supportMonitor.js';

export function createContainer() {
    const ai = { ...gemini, ...groq, ...copilot };

    const deps = {
        getSettings,
        saveSettings,
        azure,
        jira,
        ai,
        scenarioGateway,
        authClient,
        openTab,
        captureActiveTab,
        sendMessageToTab
    };

    const supportMonitor = createSupportMonitor({
        getSettings,
        storage: { get: getLocalStorage, set: setLocalStorage },
        azure,
        sendWebhook: sendSupportStatusWebhook
    });

    return { deps, supportMonitor };
}
