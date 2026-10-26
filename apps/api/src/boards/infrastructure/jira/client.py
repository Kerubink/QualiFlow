"""Cliente HTTP base do Jira Cloud (API REST via gateway api.atlassian.com, Bearer OAuth 3LO)."""
import requests


def build_jira_base_url(cloud_id):
    """Constroi URL base para Jira Cloud usando cloud_id."""
    return f'https://api.atlassian.com/ex/jira/{cloud_id}'


def jira_fetch(path, access_token, cloud_id, options=None):
    """Fetch wrapper para Jira API com tratamento de erros."""
    if options is None:
        options = {}

    base_url = build_jira_base_url(cloud_id)
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
