// Entrypoint da pagina de configuracoes: apenas wiring dos modulos.
import { startBoardOAuthLogin, startCopilotOAuthLogin } from './auth.js';
import {
    getAzureOrgValue, loadAzureOrganizations, loadAzureProjects, toggleAzureManualInput
} from './azureDiscovery.js';
import { setupModelLoaders } from './models.js';
import { setupDevModeToggle, setupDynamicGroups, setupNavigation } from './navigation.js';
import { setupRunnerTab } from './runnerProjects.js';
import { restoreOptions, saveOptions } from './settingsForm.js';

document.addEventListener('DOMContentLoaded', () => {
    restoreOptions();
    setupNavigation();
    setupDynamicGroups();
    setupModelLoaders();
    setupRunnerTab();
    setupDevModeToggle();
    document.getElementById('copilot-login-btn')?.addEventListener('click', startCopilotOAuthLogin);
    document.getElementById('azure-login-btn')?.addEventListener('click', () => startBoardOAuthLogin('azure'));
    document.getElementById('jira-login-btn')?.addEventListener('click', () => startBoardOAuthLogin('jira'));
    document.getElementById('refresh-azure-orgs-btn')?.addEventListener('click', () => loadAzureOrganizations());
    document.getElementById('refresh-azure-projects-btn')?.addEventListener('click', () => loadAzureProjects(getAzureOrgValue()));
    document.getElementById('azure-org')?.addEventListener('change', () => {
        toggleAzureManualInput('org');
        const orgUrl = getAzureOrgValue();
        if (orgUrl) loadAzureProjects(orgUrl);
    });
    document.getElementById('azure-project')?.addEventListener('change', () => toggleAzureManualInput('project'));
});
document.getElementById('settings-form').addEventListener('submit', saveOptions);
