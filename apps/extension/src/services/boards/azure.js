// Proxy fino para o backend QualiFlow: nenhuma chamada direta a dev.azure.com com PAT.
// Autenticacao via OAuth Microsoft Entra ID (sessao obtida em auth/board/session).
import { callBoardBackend } from "./backendClient.js";

export async function azureGetWorkItem(id, settings) {
	const body = await callBoardBackend(
		"azure",
		"/api/board/azure/work-item",
		{ orgUrl: settings.azureOrg, project: settings.azureProject, workItemId: id },
		settings
	);
	return body.data;
}

export function formatParametersXml(parameters) {
	if (!parameters || Object.keys(parameters).length === 0) return "";
	let xml = '<parameters>';
	for (const name of Object.keys(parameters)) {
		const cleanName = name.startsWith('@') ? name.slice(1) : name;
		xml += `<param name="${cleanName}" bind="default"/>`;
	}
	xml += '</parameters>';
	return xml;
}

export function formatLocalDataSourceXml(parameters) {
	if (!parameters || Object.keys(parameters).length === 0) return "";

	const cleanParams = Object.entries(parameters).reduce((acc, [k, v]) => {
		const cleanName = k.startsWith('@') ? k.slice(1) : k;
		acc[cleanName] = v || '';
		return acc;
	}, {});

	const colDefs = Object.keys(cleanParams).map(name =>
		`<xs:element name="${name}" type="xs:string" minOccurs="0" />`
	).join('');

	const rowValues = Object.entries(cleanParams).map(([name, val]) =>
		`<${name}>${val}</${name}>`
	).join('');

	return (
		`<NewDataSet>` +
		`<xs:schema id="NewDataSet" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:msdata="urn:schemas-microsoft-com:xml-msdata">` +
		`<xs:element name="NewDataSet" msdata:IsDataSet="true" msdata:Locale="">` +
		`<xs:complexType><xs:choice minOccurs="0" maxOccurs="unbounded">` +
		`<xs:element name="Table1"><xs:complexType><xs:sequence>` +
		colDefs +
		`</xs:sequence></xs:complexType></xs:element>` +
		`</xs:choice></xs:complexType></xs:element>` +
		`</xs:schema>` +
		`<diffgr:diffgram xmlns:msdata="urn:schemas-microsoft-com:xml-msdata" xmlns:diffgr="urn:schemas-microsoft-com:xml-diffgram-v1">` +
		`<NewDataSet><Table1 diffgr:id="Table11" msdata:rowOrder="0">` +
		rowValues +
		`</Table1></NewDataSet>` +
		`</diffgr:diffgram>` +
		`</NewDataSet>`
	);
}

export function extractScenarioParams(item) {
	const textToScan = `${item.title || ''} ${item.bdd_description || ''} ${item.steps?.map(s => `${s.action || ''} ${s.expected || ''}`).join(' ') || ''}`;
	return [...new Set((textToScan.match(/@\w+/g) || []).map(p => p.trim()))];
}

export function ensureScenarioParamsDefault(item) {
	const paramNames = extractScenarioParams(item);
	if (paramNames.length === 0) return;

	item.parameters = item.parameters || {};
	for (const pName of paramNames) {
		if (!item.parameters[pName] || item.parameters[pName].trim() === '') {
			item.parameters[pName] = '###';
		}
	}
}

export function isValidAzureAssignee(value) {
	if (!value) return false;
	const trimmed = value.trim();
	if (!trimmed) return false;

	const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	const domainUserPattern = /^[^\\\s]+\\[^\\\s]+$/;
	return emailPattern.test(trimmed) || domainUserPattern.test(trimmed);
}

export function stepsToXml(stepsArray) {
	let xml = `<steps id="0" last="${stepsArray.length}">`;
	stepsArray.forEach((step, idx) => {
		const escapeXml = (unsafe) => (unsafe || '').replace(/[<>&'"]/g, c => {
			switch (c) {
				case '<': return '&lt;';
				case '>': return '&gt;';
				case '&': return '&amp;';
				case "'": return '&apos;';
				case '"': return '&quot;';
			}
		});

		const actionText = step.needs_evidence ? `📸 [EVIDÊNCIA OBRIGATÓRIA] ${step.action}` : step.action;

		xml += `
	  <step id="${idx + 1}" type="ValidateStep">
		  <parameterizedString isformatted="true">${escapeXml(actionText)}</parameterizedString>
		  <parameterizedString isformatted="true">${escapeXml(step.expected)}</parameterizedString>
		  <description/>
	  </step>`;
	});
	xml += '</steps>';
	return xml;
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

export async function azureUpdateTestCase(item, settings, parentData) {
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

