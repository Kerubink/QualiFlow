// Proxy fino para o backend QualiFlow: nenhuma chamada direta a dev.azure.com com PAT.
// Autenticacao via OAuth Microsoft Entra ID (sessao obtida em auth/board/session).
import { callBoardBackend } from "./boardClient.js";

// Auto-discovery: usadas apos o login Microsoft para listar organizacoes/projetos do usuario
// em vez de exigir digitar a URL da organizacao e o nome do projeto manualmente.
export async function azureListOrganizations(settings) {
	const body = await callBoardBackend("azure", "/api/board/azure/organizations", {}, settings);
	return body.data || [];
}

export async function azureListProjects(orgUrl, settings) {
	const body = await callBoardBackend("azure", "/api/board/azure/projects", { orgUrl }, settings);
	return body.data || [];
}

export async function azureGetWorkItem(id, settings) {
	const body = await callBoardBackend(
		"azure",
		"/api/board/azure/work-item",
		{ orgUrl: settings.azureOrg, project: settings.azureProject, workItemId: id },
		settings
	);
	return body.data;
}

export async function azureCreateTestCase(item, settings, parentData) {
	const body = await callBoardBackend(
		"azure",
		"/api/board/azure/test-case",
		{ orgUrl: settings.azureOrg, project: settings.azureProject, item, parentData },
		settings
	);
	return body.data;
}

export async function azureGetQaDashboard(settings) {
	const body = await callBoardBackend(
		"azure",
		"/api/board/azure/dashboard",
		{ orgUrl: settings.azureOrg, project: settings.azureProject },
		settings
	);
	return body.data;
}

export async function azureGetTestCaseAnalytics(settings) {
	const body = await callBoardBackend(
		"azure",
		"/api/board/azure/test-case-analytics",
		{ orgUrl: settings.azureOrg, project: settings.azureProject },
		settings
	);
	return body.data;
}

export async function azureUpdateWorkItemsState(ids, newState, settings) {
	return callBoardBackend(
		"azure",
		"/api/board/azure/work-items-state",
		{ orgUrl: settings.azureOrg, project: settings.azureProject, ids, newState },
		settings
	);
}

export async function azureGetTestRunnerCards(settings, searchQuery) {
	const body = await callBoardBackend(
		"azure",
		"/api/board/azure/test-runner-cards",
		{ orgUrl: settings.azureOrg, project: settings.azureProject, query: searchQuery },
		settings
	);
	return body.data;
}

export async function azureGetSupportCards(settings) {
	const body = await callBoardBackend(
		"azure",
		"/api/board/azure/support-cards",
		{ orgUrl: settings.azureOrg, project: settings.azureProject },
		settings
	);
	return body.data;
}

export async function azureGetTestCasesForWorkItem(workItemId, settings) {
	const body = await callBoardBackend(
		"azure",
		"/api/board/azure/test-cases-for-work-item",
		{ orgUrl: settings.azureOrg, project: settings.azureProject, workItemId },
		settings
	);
	return body.data;
}

export async function azureGetTestPointsForTestCases(testCaseIds, settings) {
	const body = await callBoardBackend(
		"azure",
		"/api/board/azure/test-points",
		{ orgUrl: settings.azureOrg, project: settings.azureProject, testCaseIds },
		settings
	);
	return body.data;
}

export async function azureAddAdhocTestResults(runId, testCaseIds, settings) {
	const body = await callBoardBackend(
		"azure",
		"/api/board/azure/adhoc-results",
		{ orgUrl: settings.azureOrg, project: settings.azureProject, runId, testCaseIds },
		settings
	);
	return body.data;
}

export async function azureCreateTestRun(title, planId, pointIds, settings) {
	const body = await callBoardBackend(
		"azure",
		"/api/board/azure/test-run",
		{ orgUrl: settings.azureOrg, project: settings.azureProject, title, planId, pointIds },
		settings
	);
	return body.runId;
}

export async function azureGetRunResults(runId, settings) {
	const body = await callBoardBackend(
		"azure",
		"/api/board/azure/run-results",
		{ orgUrl: settings.azureOrg, project: settings.azureProject, runId },
		settings
	);
	return body.data;
}

export async function azureUpdateTestResult(runId, resultId, outcome, comment, stepResults, settings) {
	return callBoardBackend(
		"azure",
		"/api/board/azure/test-result",
		{ orgUrl: settings.azureOrg, project: settings.azureProject, runId, resultId, outcome, comment, stepResults },
		settings
	);
}

export async function azureCompleteTestRun(runId, state, settings) {
	return callBoardBackend(
		"azure",
		"/api/board/azure/complete-run",
		{ orgUrl: settings.azureOrg, project: settings.azureProject, runId, state },
		settings
	);
}

export async function azureCreateBugFromFailure(title, comment, testCaseId, linkedWorkItemId, settings) {
	const body = await callBoardBackend(
		"azure",
		"/api/board/azure/bug",
		{ orgUrl: settings.azureOrg, project: settings.azureProject, title, comment, testCaseId, workItemId: linkedWorkItemId },
		settings
	);
	return body.bugId;
}

export async function azureAddAttachment(runId, resultId, fileName, base64Content, comment, settings) {
	const body = await callBoardBackend(
		"azure",
		"/api/board/azure/attachment",
		{ orgUrl: settings.azureOrg, project: settings.azureProject, runId, resultId, fileName, base64Content, comment },
		settings
	);
	return body.data;
}

export async function azureGetProjectIterations(settings) {
	const body = await callBoardBackend(
		"azure",
		"/api/board/azure/project-iterations",
		{ orgUrl: settings.azureOrg, project: settings.azureProject },
		settings
	);
	return body.data;
}

export async function azureGetDeployValidation(settings, iterationPath) {
	const body = await callBoardBackend(
		"azure",
		"/api/board/azure/deploy-validation",
		{ orgUrl: settings.azureOrg, project: settings.azureProject, iterationPath },
		settings
	);
	return body.data;
}

