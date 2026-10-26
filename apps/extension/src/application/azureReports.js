import { hasAzureConfig } from '../domain/settingsRules.js';

const MSG_MISSING_CONFIG = 'Configurações ausentes. Por favor, configure a extensão primeiro.';
const MSG_INCOMPLETE_AZURE = 'Configuração incompleta do Azure.';

async function withAzureSettings({ getSettings }, message) {
    const settings = await getSettings();
    if (!hasAzureConfig(settings)) throw new Error(message);
    return settings;
}

export async function getQaDashboard(deps) {
    const settings = await withAzureSettings(deps, MSG_MISSING_CONFIG);
    return deps.azure.azureGetQaDashboard(settings);
}

export async function getTestCaseAnalytics(deps) {
    const settings = await withAzureSettings(deps, MSG_MISSING_CONFIG);
    return deps.azure.azureGetTestCaseAnalytics(settings);
}

export async function getSupportCards(deps) {
    const settings = await withAzureSettings(deps, MSG_INCOMPLETE_AZURE);
    return deps.azure.azureGetSupportCards(settings);
}

export async function getProjectIterations(deps) {
    const settings = await withAzureSettings(deps, MSG_MISSING_CONFIG);
    return deps.azure.azureGetProjectIterations(settings);
}

export async function getDeployValidation({ iterationPath }, deps) {
    const settings = await withAzureSettings(deps, MSG_MISSING_CONFIG);
    if (!iterationPath) throw new Error('Selecione uma Sprint/Iteration.');
    return deps.azure.azureGetDeployValidation(settings, iterationPath);
}

export async function updateWorkItemsState({ ids, newState }, { getSettings, azure }) {
    const settings = await getSettings();
    return azure.azureUpdateWorkItemsState(ids, newState, settings);
}

export async function listAzureOrganizations({ getSettings, azure }) {
    const settings = await getSettings();
    return azure.azureListOrganizations(settings);
}

export async function listAzureProjects({ orgUrl }, { getSettings, azure }) {
    const settings = await getSettings();
    return azure.azureListProjects(orgUrl, settings);
}
