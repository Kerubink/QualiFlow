// Service worker (MV3): so faz o wiring. Regras vivem em application/domain; adaptadores em infrastructure.
import { createPeriodicAlarm } from '../../infrastructure/browser/alarms.js';
import { createContainer } from './container.js';
import { createMessageRouter, mergeHandlers } from './router.js';
import { createAiHandlers } from './handlers/ai.js';
import { createAuthHandlers } from './handlers/auth.js';
import { createAzureReportHandlers } from './handlers/azureReports.js';
import { createCardDataHandlers } from './handlers/cardData.js';
import { createScenarioHandlers } from './handlers/scenarios.js';
import { createTestRunnerHandlers } from './handlers/testRunner.js';

const SUPPORT_MONITOR_ALARM_NAME = 'qualiflow-support-status-monitor';
const SUPPORT_MONITOR_INTERVAL_MINUTES = 5;

const { deps, supportMonitor } = createContainer();

function ensureSupportMonitorAlarm() {
    createPeriodicAlarm(SUPPORT_MONITOR_ALARM_NAME, SUPPORT_MONITOR_INTERVAL_MINUTES);
}

chrome.runtime.onInstalled.addListener(() => {
    ensureSupportMonitorAlarm();
    void supportMonitor.run();
});

chrome.runtime.onStartup.addListener(() => {
    ensureSupportMonitorAlarm();
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm?.name !== SUPPORT_MONITOR_ALARM_NAME) return;
    void supportMonitor.run();
});

ensureSupportMonitorAlarm();

const handlers = mergeHandlers(
    createCardDataHandlers(deps),
    createAzureReportHandlers(deps, supportMonitor),
    createTestRunnerHandlers(deps),
    createAiHandlers(deps),
    createScenarioHandlers(deps),
    createAuthHandlers(deps)
);

chrome.runtime.onMessage.addListener(createMessageRouter(handlers));
