"""Servico de integracao com Jira Cloud via API REST.

Implementacao de chamadas HTTP para trabalhar com Issues, Teste Links,
e campos customizados. Autenticacao via OAuth Bearer token (Atlassian 3LO).
"""
import re
import requests


def _to_adf_paragraph(text):
    """Converte texto para formato ADF (Atlassian Document Format) paragraph."""
    return {
        'type': 'paragraph',
        'content': [{'type': 'text', 'text': str(text or '')}]
    }


def _adf_to_plain_text(adf_node):
    """Converte ADF node para texto plano."""
    if not adf_node:
        return ''
    if isinstance(adf_node, str):
        return adf_node
    
    def walk(node):
        if not node:
            return ''
        if isinstance(node, list):
            return ''.join(walk(n) for n in node)
        if node.get('type') == 'text':
            return node.get('text', '')
        
        content = node.get('content', [])
        if isinstance(content, list):
            content_text = ''.join(walk(c) for c in content)
        else:
            content_text = ''
        
        node_type = node.get('type', '')
        if node_type in ['paragraph', 'heading', 'listItem']:
            return f'{content_text}\n'
        if node_type in ['bulletList', 'orderedList', 'doc']:
            return content_text
        
        return content_text
    
    result = walk(adf_node)
    result = re.sub(r'\n{3,}', '\n\n', result)
    return result.strip()


def _build_jira_base_url(cloud_id):
    """Constroi URL base para Jira Cloud usando cloud_id."""
    return f'https://api.atlassian.com/ex/jira/{cloud_id}'


def _jira_fetch(path, access_token, cloud_id, options=None):
    """Fetch wrapper para Jira API com tratamento de erros."""
    if options is None:
        options = {}
    
    base_url = _build_jira_base_url(cloud_id)
    headers = {
        'Authorization': f'Bearer {access_token}',
        'Accept': 'application/json'
    }
    
    if options.get('body'):
        headers['Content-Type'] = 'application/json'
    
    headers.update(options.get('headers', {}))
    
    method = options.get('method', 'GET')
    body = options.get('body')
    
    response = requests.request(
        method,
        f'{base_url}{path}',
        headers=headers,
        json=body if body and method in ['POST', 'PUT', 'PATCH'] else None,
        timeout=30
    )
    
    if not response.ok:
        error_body = response.text
        raise RuntimeError(f'Jira API {response.status_code}: {error_body or response.reason}')
    
    if response.status_code == 204:
        return None
    
    return response.json()


def _is_likely_test_issue(issue, test_issue_type):
    """Verifica se issue provavelmente eh um test case."""
    expected_type = (test_issue_type or 'Task').lower()
    issue_type = str(issue.get('fields', {}).get('issuetype', {}).get('name', '')).lower()
    labels = [str(l).lower() for l in issue.get('fields', {}).get('labels', [])]
    
    return issue_type == expected_type or 'qualiflow' in labels or 'automated-test' in labels


def _jira_get_linked_tests(issue_data, access_token, cloud_id, test_issue_type):
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
            linked_issue = _jira_fetch(
                f'/rest/api/3/issue/{key}?fields=summary,description,issuetype,labels',
                access_token,
                cloud_id
            )
            
            if not _is_likely_test_issue(linked_issue, test_issue_type):
                continue
            
            tests.append({
                'id': linked_issue['key'],
                'title': linked_issue.get('fields', {}).get('summary') or linked_issue['key'],
                'description': _adf_to_plain_text(linked_issue.get('fields', {}).get('description')),
                'xmlStepsRaw': ''
            })
        except Exception:
            pass
    
    return tests


def jira_get_issue(access_token, cloud_id, issue_key, test_issue_type='Task', acceptance_field_id=None, project_key=None):
    """Busca uma Issue do Jira."""
    base_fields = ['summary', 'description', 'issuetype', 'labels', 'issuelinks', 'project']
    if acceptance_field_id and acceptance_field_id.strip():
        base_fields.append(acceptance_field_id.strip())
    
    data = _jira_fetch(
        f'/rest/api/3/issue/{issue_key}?fields={",".join(base_fields)}',
        access_token,
        cloud_id
    )
    
    acceptance_value = ''
    if acceptance_field_id and acceptance_field_id.strip():
        acceptance_value = data.get('fields', {}).get(acceptance_field_id.strip(), '')
    
    base_url = _build_jira_base_url(cloud_id)
    
    return {
        'id': data['key'],
        'url': f'{base_url}/browse/{data["key"]}',
        'title': data.get('fields', {}).get('summary', ''),
        'description': _adf_to_plain_text(data.get('fields', {}).get('description')),
        'acceptance_criteria': _adf_to_plain_text(acceptance_value),
        'type': data.get('fields', {}).get('issuetype', {}).get('name', ''),
        'tags': '; '.join(data.get('fields', {}).get('labels', [])),
        'areaPath': '',
        'iterationPath': '',
        'existing_tests': _jira_get_linked_tests(data, access_token, cloud_id, test_issue_type),
        'provider': 'jira',
        'projectKey': data.get('fields', {}).get('project', {}).get('key') or (project_key or '')
    }


def jira_create_test_case(access_token, cloud_id, scenario, parent_issue_key, project_key, test_issue_type='Task', link_type='Relates'):
    """Cria um Test Case no Jira."""
    if not project_key or not project_key.strip():
        raise RuntimeError('jiraProjectKey nao configurado.')
    
    test_issue_type = (test_issue_type or 'Task').strip()
    link_type = (link_type or 'Relates').strip()
    
    steps = scenario.get('steps', [])
    step_lines = [
        f'{idx + 1}. Acao: {s.get("action", "")} | Esperado: {s.get("expected", "")}'
        for idx, s in enumerate(steps)
    ]
    description_text = f'{scenario.get("bdd_description", "")}\n\nPassos do Teste:\n{chr(10).join(step_lines)}'.strip()
    
    created = _jira_fetch(
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
                        'content': [_to_adf_paragraph(description_text)]
                    },
                    'issuetype': {'name': test_issue_type},
                    'labels': ['QualiFlow', 'Automated-Test']
                }
            }
        }
    )
    
    _jira_fetch(
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
