// Proxy fino para o backend QualiFlow: nenhuma chamada direta a *.atlassian.net com email+token.
// Autenticacao via OAuth Atlassian 3LO (sessao obtida em auth/board/session).
import { callBoardBackend } from "./backendClient.js";

export async function jiraGetIssue(issueKey, settings) {
	const body = await callBoardBackend(
		"jira",
		"/api/board/jira/issue",
		{
			issueKey,
			testIssueType: settings.jiraTestIssueType,
			acceptanceFieldId: settings.jiraAcceptanceFieldId,
			projectKey: settings.jiraProjectKey
		},
		settings
	);
	return body.data;
}

export async function jiraCreateTestCase(scenario, settings, parentIssueKey) {
	const body = await callBoardBackend(
		"jira",
		"/api/board/jira/test-case",
		{
			scenario,
			parentIssueKey,
			projectKey: settings.jiraProjectKey,
			testIssueType: settings.jiraTestIssueType,
			linkType: settings.jiraLinkType
		},
		settings
	);
	return body.data;
}

