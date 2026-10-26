/* Entrypoint do runner - injetado pelo QualiFlow nas URLs-alvo configuradas (<all_urls>). */
import { getStorage } from '../shared/runtime.js';
import { injectDisabledRunnerFAB, injectMinimalRunnerFAB } from './fab.js';

function bootstrap() {
    // Azure DevOps usa o dashboard/FAB do content principal.
    if (window.location.hostname.includes('dev.azure.com') || window.location.hostname.includes('visualstudio.com')) return;

    getStorage(['runnerProjects', 'runnerEnabled'], (data) => {
        if (data.runnerEnabled === false) {
            injectDisabledRunnerFAB();
            return;
        }
        const projects = data.runnerProjects || [];
        const currentUrl = window.location.href;
        const matchedProject = projects.find(p => currentUrl.startsWith(p.url));
        if (matchedProject) {
            injectMinimalRunnerFAB();
        }
    });
}

bootstrap();
