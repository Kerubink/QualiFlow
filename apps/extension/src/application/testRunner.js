import { hasAzureConfig, isRunnerDisabled } from '../domain/settingsRules.js';

const MSG_RUNNER_DISABLED = 'Runner indisponível no momento.';
const MSG_INCOMPLETE_AZURE = 'Configuração incompleta do Azure.';

// Carrega as configuracoes garantindo que o runner esta habilitado (e, opcionalmente, o Azure configurado).
async function runnerSettings({ getSettings }, { requireAzure = false } = {}) {
    const settings = await getSettings();
    if (isRunnerDisabled(settings)) throw new Error(MSG_RUNNER_DISABLED);
    if (requireAzure && !hasAzureConfig(settings)) throw new Error(MSG_INCOMPLETE_AZURE);
    return settings;
}

export async function getRunnerCards({ query }, deps) {
    const settings = await runnerSettings(deps, { requireAzure: true });
    return deps.azure.azureGetTestRunnerCards(settings, query);
}

export async function getTestCasesForWorkItem({ workItemId }, deps) {
    const settings = await runnerSettings(deps, { requireAzure: true });
    return deps.azure.azureGetTestCasesForWorkItem(workItemId, settings);
}

export async function getTestPoints({ testCaseIds }, deps) {
    const settings = await runnerSettings(deps);
    return deps.azure.azureGetTestPointsForTestCases(testCaseIds, settings);
}

export async function createTestRun({ title, planId, pointIds }, deps) {
    const settings = await runnerSettings(deps);
    return deps.azure.azureCreateTestRun(title, planId, pointIds, settings);
}

export async function getRunResults({ runId }, deps) {
    const settings = await runnerSettings(deps);
    return deps.azure.azureGetRunResults(runId, settings);
}

export async function addAdhocResults({ runId, testCaseIds }, deps) {
    const settings = await runnerSettings(deps);
    return deps.azure.azureAddAdhocTestResults(runId, testCaseIds, settings);
}

export async function updateTestResult({ runId, resultId, outcome, comment, stepResults }, deps) {
    const settings = await runnerSettings(deps);
    return deps.azure.azureUpdateTestResult(runId, resultId, outcome, comment, stepResults, settings);
}

export async function completeTestRun({ runId, state }, deps) {
    const settings = await runnerSettings(deps);
    return deps.azure.azureCompleteTestRun(runId, state, settings);
}

export async function createBugFromFailure({ title, comment, testCaseId, workItemId }, deps) {
    const settings = await runnerSettings(deps);
    return deps.azure.azureCreateBugFromFailure(title, comment, testCaseId, workItemId, settings);
}

// Anexos de evidencia nao dependem da flag do runner (comportamento original).
export async function addAttachment({ runId, resultId, fileName, base64Content, comment }, { getSettings, azure }) {
    const settings = await getSettings();
    return azure.azureAddAttachment(runId, resultId, fileName, base64Content, comment || '', settings);
}
