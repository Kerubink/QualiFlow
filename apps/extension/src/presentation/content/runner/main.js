/* Entrypoint do runner - injetado pelo QualiFlow nas URLs-alvo configuradas (<all_urls>). */
import { getStorage } from '../shared/runtime.js';
import { injectDisabledRunnerFAB, injectMinimalRunnerFAB } from './fab.js';
import { startAutofill } from './autofill.js';
import { initPauseGuard } from './pauseGuard.js';
import { enableCssDebug } from './cssDebug.js';
import { S } from './state.js';
import { initRunStore } from './runStore.js';
import { initShortcuts } from './shortcuts.js';
import { initAlerts } from './alerts.js';
import { initPerfObservers } from './uiTools.js';
import { isPerfAutoStored, startPerfAutoLog } from './perfLog.js';

function bootstrap() {
    // Azure DevOps usa o dashboard/FAB do content principal.
    if (window.location.hostname.includes('dev.azure.com') || window.location.hostname.includes('visualstudio.com')) return;

    getStorage(['runnerProjects', 'runnerEnabled', 'runnerAutofill', 'runnerCssDebug', 'runnerProbe', 'runnerAlerts', 'runnerPerfAuto'], (data) => {
        if (data.runnerEnabled === false) {
            injectDisabledRunnerFAB();
            return;
        }
        const projects = data.runnerProjects || [];
        const currentUrl = window.location.href;
        const matchedProject = projects.find(p => currentUrl.startsWith(p.url));
        if (matchedProject) {
            injectMinimalRunnerFAB();
            initPauseGuard();
            S.probeEnabled = data.runnerProbe !== false;
            S.alertsEnabled = data.runnerAlerts !== false;
            initRunStore();
            initShortcuts();
            initAlerts();
            initPerfObservers();
            if (isPerfAutoStored(data)) startPerfAutoLog();
            if (data.runnerAutofill !== false) startAutofill();
            if (data.runnerCssDebug === true) enableCssDebug();
        }
    });
}

bootstrap();
