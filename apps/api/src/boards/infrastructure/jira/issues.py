"""Issues do Jira Cloud: leitura (com testes vinculados) e criacao de Test Case com link ao card pai."""
from ...domain.adf import adf_to_plain_text, to_adf_paragraph
from ...domain.jira_issues import build_test_case_description, is_likely_test_issue
from .client import build_jira_base_url, jira_fetch


def get_linked_tests(issue_data, access_token, cloud_id, test_issue_type):
    """Busca Test Cases vinculados a uma Issue."""
    links = issue_data.get('fields', {}).get('issuelinks', [])
    if not links:
        return []

    linked_keys = [
        link.get('outwardIssue', {}).get('key') or link.get('inwardIssue', {}).get('key')
        for link in links
    ]
    linked_keys = [k for k in linked_keys if k]
    unique_keys = list(set(linked_keys))

    tests = []
    for key in unique_keys:
        try:
            linked_issue = jira_fetch(
                f'/rest/api/3/issue/{key}?fields=summary,description,issuetype,labels',
                access_token,
                cloud_id
            )

            if not is_likely_test_issue(linked_issue, test_issue_type):
                continue

            tests.append({
                'id': linked_issue['key'],
                'title': linked_issue.get('fields', {}).get('summary') or linked_issue['key'],
                'description': adf_to_plain_text(linked_issue.get('fields', {}).get('description')),
                'xmlStepsRaw': ''
            })
        except Exception:
            pass

    return tests


def get_issue(access_token, cloud_id, issue_key, test_issue_type='Task', acceptance_field_id=None, project_key=None):
    """Busca uma Issue do Jira."""
    base_fields = ['summary', 'description', 'issuetype', 'labels', 'issuelinks', 'project']
    if acceptance_field_id and acceptance_field_id.strip():
        base_fields.append(acceptance_field_id.strip())

    data = jira_fetch(
        f'/rest/api/3/issue/{issue_key}?fields={",".join(base_fields)}',
        access_token,
        cloud_id
    )

    acceptance_value = ''
    if acceptance_field_id and acceptance_field_id.strip():
        acceptance_value = data.get('fields', {}).get(acceptance_field_id.strip(), '')

    base_url = build_jira_base_url(cloud_id)

    return {
        'id': data['key'],
        'url': f'{base_url}/browse/{data["key"]}',
        'title': data.get('fields', {}).get('summary', ''),
        'description': adf_to_plain_text(data.get('fields', {}).get('description')),
        'acceptance_criteria': adf_to_plain_text(acceptance_value),
        'type': data.get('fields', {}).get('issuetype', {}).get('name', ''),
        'tags': '; '.join(data.get('fields', {}).get('labels', [])),
        'areaPath': '',
        'iterationPath': '',
        'existing_tests': get_linked_tests(data, access_token, cloud_id, test_issue_type),
        'provider': 'jira',
        'projectKey': data.get('fields', {}).get('project', {}).get('key') or (project_key or '')
    }


def create_test_case(access_token, cloud_id, scenario, parent_issue_key, project_key, test_issue_type='Task', link_type='Relates'):
    """Cria um Test Case no Jira."""
    if not project_key or not project_key.strip():
        raise RuntimeError('jiraProjectKey nao configurado.')

    test_issue_type = (test_issue_type or 'Task').strip()
    link_type = (link_type or 'Relates').strip()

    description_text = build_test_case_description(scenario)

    created = jira_fetch(
        '/rest/api/3/issue',
        access_token,
        cloud_id,
        {
            'method': 'POST',
            'body': {
                'fields': {
                    'project': {'key': project_key},
                    'summary': scenario.get('title', ''),
                    'description': {
                        'type': 'doc',
                        'version': 1,
                        'content': [to_adf_paragraph(description_text)]
                    },
                    'issuetype': {'name': test_issue_type},
                    'labels': ['QualiFlow', 'Automated-Test']
                }
            }
        }
    )

    jira_fetch(
        '/rest/api/3/issueLink',
        access_token,
        cloud_id,
        {
            'method': 'POST',
            'body': {
                'type': {'name': link_type},
                'inwardIssue': {'key': created['key']},
                'outwardIssue': {'key': parent_issue_key}
            }
        }
    )

    return created
