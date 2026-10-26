import { getLocalStorage, setLocalStorage } from '../browser/storage.js';

// Chaves de configuracao lidas pelo background (chrome.storage.local).
export const SETTINGS_KEYS = [
    'azureSessionToken', 'azurePat', 'azureOrg', 'azureProject',
    'jiraSessionToken', 'jiraDomain', 'jiraProjectKey', 'jiraTestIssueType', 'jiraAcceptanceFieldId', 'jiraLinkType',
    'supportWebhookUrl',
    'geminiKey', 'geminiModel',
    'qaEmail', 'qaTag', 'runnerEnabled', 'selectedAi', 'selectedBoard',
    'copilotToken', 'copilotSessionToken', 'copilotBackendUrl', 'copilotModel',
    'groqKey', 'groqModel'
];

export function getSettings() {
    return getLocalStorage(SETTINGS_KEYS);
}

export function saveSettings(partial) {
    return setLocalStorage(partial);
}
