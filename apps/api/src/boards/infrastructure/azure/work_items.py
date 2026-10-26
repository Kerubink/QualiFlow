"""Work Items do Azure DevOps: leitura (com testes vinculados), listagens WIQL, estado em lote e criacao de Bug.
"""
import requests

from ...domain.deploy_validation import is_deploy_relevant_type, is_excluded_deploy_type
from .http import read_headers, write_headers


def get_work_item(access_token, org_url, project, work_item_id):
    """Busca um Work Item com todas suas relacoes e testes existentes."""
    headers = read_headers(access_token)
    url = f'{org_url}/{project}/_apis/wit/workitems/{work_item_id}?$expand=all&api-version=7.1'

    response = requests.get(url, headers=headers, timeout=30)
    if not response.ok:
        raise RuntimeError(f'Failed to fetch Work Item: {response.status_code} {response.text}')

    work_item = response.json()
    fields = work_item.get('fields', {})

    existing_tests = []
    if work_item.get('relations'):
        for rel in work_item['relations']:
            rel_type = rel.get('rel', '')
            if rel_type and ('TestedBy' in rel_type or 'Tests' in rel_type):
                try:
                    t_id = int(rel['url'].split('/')[-1])
                    tc_url = f'{org_url}/{project}/_apis/wit/workitems/{t_id}?api-version=7.1'
                    tc_response = requests.get(tc_url, headers=headers, timeout=30)
                    if tc_response.ok:
                        tc_data = tc_response.json()
                        tc_fields = tc_data.get('fields', {})
                        xml_steps = tc_fields.get('Microsoft.VSTS.TCM.Steps', '')
                        existing_tests.append({
                            'id': t_id,
                            'title': tc_fields.get('System.Title', ''),
                            'description': tc_fields.get('Custom.Gherkin') or tc_fields.get('System.Description', ''),
                            'xmlStepsRaw': xml_steps
                        })
                except (ValueError, KeyError):
                    pass

    return {
        'id': work_item.get('id'),
        'url': work_item.get('url'),
        'title': fields.get('System.Title', ''),
        'description': fields.get('System.Description', ''),
        'acceptance_criteria': fields.get('Microsoft.VSTS.Common.AcceptanceCriteria', ''),
        'type': fields.get('System.WorkItemType', ''),
        'tags': fields.get('System.Tags', ''),
        'areaPath': fields.get('System.AreaPath', ''),
        'iterationPath': fields.get('System.IterationPath', ''),
        'existing_tests': existing_tests,
        'org': org_url,
        'project': project
    }


def update_work_items_state(access_token, org_url, project, ids, new_state):
    """Atualiza estado de multiplos Work Items."""
    headers = write_headers(access_token, 'application/json-patch+json')

    patch = [{'op': 'add', 'path': '/fields/System.State', 'value': new_state}]

    failed = 0
    for work_item_id in ids:
        url = f'{org_url}/{project}/_apis/wit/workitems/{work_item_id}?api-version=7.1'
        response = requests.patch(url, headers=headers, json=patch, timeout=30)
        if not response.ok:
            failed += 1

    if failed > 0:
        raise RuntimeError(f'Falha ao atualizar {failed} itens.')

    return {'success': True, 'count': len(ids)}


def get_test_runner_cards(access_token, org_url, project, search_query=None):
    """Busca cards para execucao de testes com filtro opcional."""
    headers = read_headers(access_token)

    where_clause = f"[System.TeamProject] = '{project}' AND [System.WorkItemType] <> 'Test Case'"

    if search_query:
        try:
            query_id = int(search_query)
            where_clause += f" AND [System.Id] = {query_id}"
        except ValueError:
            where_clause += f" AND [System.Title] CONTAINS '{search_query.replace(chr(39), chr(39)+chr(39))}'"

    query = f"""
        SELECT [System.Id]
        FROM workitems
        WHERE {where_clause}
        ORDER BY [System.ChangedDate] DESC
    """

    wiql_url = f'{org_url}/{project}/_apis/wit/wiql?api-version=7.1'
    wiql_response = requests.post(wiql_url, headers=headers, json={'query': query}, timeout=60)

    if not wiql_response.ok:
        raise RuntimeError(f'Falha ao executar WIQL: {wiql_response.status_code}')

    wiql_data = wiql_response.json()
    work_items = wiql_data.get('workItems', [])

    if not work_items:
        return []

    ids = [wi['id'] for wi in work_items[:30]]
    details_url = f'{org_url}/{project}/_apis/wit/workitems?ids={",".join(map(str, ids))}&$expand=relations&api-version=7.1'

    details_response = requests.get(details_url, headers=headers, timeout=60)

    if not details_response.ok:
        raise RuntimeError(f'Falha ao buscar detalhes: {details_response.status_code}')

    details_data = details_response.json()
    pb_is = details_data.get('value', [])

    valid_cards = []
    for wi in pb_is:
        has_test_case = False
        if wi.get('relations'):
            for rel in wi['relations']:
                rel_type = rel.get('rel', '')
                if rel_type and ('TestedBy' in rel_type or 'Tests' in rel_type):
                    try:
                        t_id = int(rel['url'].split('/')[-1])
                        has_test_case = True
                        break
                    except (ValueError, IndexError):
                        pass

        if has_test_case:
            valid_cards.append({
                'id': wi['id'],
                'title': wi.get('fields', {}).get('System.Title') or f'Sem titulo ({wi["id"]})',
                'type': wi.get('fields', {}).get('System.WorkItemType', ''),
                'state': wi.get('fields', {}).get('System.State', ''),
                'iterationPath': wi.get('fields', {}).get('System.IterationPath', 'Desconhecido'),
                'url': wi.get('_links', {}).get('html', {}).get('href') or f'{org_url}/{project}/_workitems/edit/{wi["id"]}'
            })

    return valid_cards


def get_support_cards(access_token, org_url, project):
    """Busca cards de Sustentacao."""
    headers = read_headers(access_token)

    query = f"""
        SELECT [System.Id]
        FROM workitems
        WHERE [System.TeamProject] = '{project}'
        AND (
            [System.WorkItemType] = 'Sustentacao'
            OR [System.WorkItemType] = 'Sustentacao'
            OR [System.WorkItemType] CONTAINS 'Sustent'
        )
        ORDER BY [System.ChangedDate] DESC
    """

    wiql_url = f'{org_url}/{project}/_apis/wit/wiql?api-version=7.1'
    wiql_response = requests.post(wiql_url, headers=headers, json={'query': query}, timeout=60)

    if not wiql_response.ok:
        raise RuntimeError(f'Falha ao executar WIQL de suportes: {wiql_response.status_code}')

    wiql_data = wiql_response.json()
    work_items = wiql_data.get('workItems', [])
    if not work_items:
        return []

    ids = [wi['id'] for wi in work_items[:100]]
    details_url = f'{org_url}/{project}/_apis/wit/workitems?ids={",".join(map(str, ids))}&api-version=7.1'
    details_response = requests.get(details_url, headers=headers, timeout=60)

    if not details_response.ok:
        raise RuntimeError(f'Falha ao buscar detalhes dos suportes: {details_response.status_code}')

    details_data = details_response.json()
    items = details_data.get('value', [])

    return [
        {
            'id': wi['id'],
            'title': wi.get('fields', {}).get('System.Title') or f'Sem titulo ({wi["id"]})',
            'type': wi.get('fields', {}).get('System.WorkItemType', ''),
            'state': wi.get('fields', {}).get('System.State', ''),
            'assignedTo': wi.get('fields', {}).get('System.AssignedTo', ''),
            'requester': wi.get('fields', {}).get('System.CreatedBy', ''),
            'tags': wi.get('fields', {}).get('System.Tags', ''),
            'iterationPath': wi.get('fields', {}).get('System.IterationPath', 'Desconhecido'),
            'url': wi.get('_links', {}).get('html', {}).get('href') or f'{org_url}/{project}/_workitems/edit/{wi["id"]}'
        }
        for wi in items
    ]


def create_bug_from_failure(access_token, org_url, project, title, comment, test_case_id=None, linked_work_item_id=None):
    """Cria um Bug a partir de uma falha em teste."""
    headers = write_headers(access_token, 'application/json-patch+json')

    ops = [
        {'op': 'add', 'path': '/fields/System.Title', 'value': title},
        {'op': 'add', 'path': '/fields/System.WorkItemType', 'value': 'Bug'},
        {'op': 'add', 'path': '/fields/Microsoft.VSTS.TCM.ReproSteps', 'value': comment or ''}
    ]

    if linked_work_item_id:
        ops.append({
            'op': 'add',
            'path': '/relations/-',
            'value': {
                'rel': 'Microsoft.VSTS.Common.TestedBy-Reverse',
                'url': f'{org_url}/{project}/_apis/wit/workItems/{linked_work_item_id}'
            }
        })

    url = f'{org_url}/{project}/_apis/wit/workitems/$Bug?api-version=7.1'
    resp = requests.post(url, headers=headers, json=ops, timeout=30)

    if not resp.ok:
        raise RuntimeError(f'Falha ao criar bug: {resp.text}')

    data = resp.json()
    return data.get('id')


def read_error_detail(response):
    """Extrai detalhes de erro da resposta Azure."""
    try:
        err = response.json()
        return err.get('message') or err.get('value', {}).get('Message') or err.get('value', {}).get('message') or response.reason or f'HTTP {response.status_code}'
    except Exception:
        return response.reason or f'HTTP {response.status_code}'


def fetch_work_items_by_ids(access_token, org_url, project, ids):
    """Fetch multiplos work items por IDs."""
    if not ids:
        return []

    headers = read_headers(access_token)
    ids_str = ','.join(map(str, ids))
    url = f'{org_url}/{project}/_apis/wit/workitems?ids={ids_str}&$expand=relations&api-version=7.1'

    response = requests.get(url, headers=headers, timeout=60)

    if not response.ok:
        raise RuntimeError(f'Falha ao buscar work items: {response.status_code}')

    return response.json().get('value', [])


def map_work_item_raw(wi, org_url, project):
    """Mapeia raw work item para estrutura interna."""
    fields = wi.get('fields', {})
    return {
        'id': wi['id'],
        'title': fields.get('System.Title', ''),
        'state': fields.get('System.State', ''),
        'type': fields.get('System.WorkItemType', ''),
        'tags': fields.get('System.Tags', ''),
        'areaPath': fields.get('System.AreaPath', ''),
        'url': wi.get('_links', {}).get('html', {}).get('href') or f'{org_url}/{project}/_workitems/edit/{wi["id"]}',
        '_relations': wi.get('relations', [])
    }


def fetch_deploy_work_items(access_token, org_url, project, iteration_path):
    """Busca (WIQL + detalhes em lotes) os work items de uma sprint relevantes para a validacao
    de deploy, ja mapeados para a estrutura interna. `iteration_path` deve estar normalizado."""
    headers = read_headers(access_token)

    wiql_url = f'{org_url}/{project}/_apis/wit/wiql?api-version=7.1'
    safe_project = project.replace("'", "''")
    safe_iteration = str(iteration_path).replace("'", "''")
    query = f"""
        SELECT [System.Id]
        FROM workitems
        WHERE [System.TeamProject] = '{safe_project}'
        AND [System.IterationPath] UNDER '{safe_iteration}'
        ORDER BY [System.ChangedDate] DESC
    """

    wiql_response = requests.post(wiql_url, headers=headers, json={'query': query}, timeout=60)

    if not wiql_response.ok:
        detail = read_error_detail(wiql_response)
        raise RuntimeError(f'Falha ao buscar cards da sprint: {detail}')

    wiql_data = wiql_response.json()
    sprint_ids = [w['id'] for w in wiql_data.get('workItems', [])]

    if not sprint_ids:
        return []

    raw_items = []
    for i in range(0, len(sprint_ids), 200):
        chunk = sprint_ids[i:i+200]
        chunk_items = fetch_work_items_by_ids(access_token, org_url, project, chunk)
        raw_items.extend(chunk_items)

    return [
        map_work_item_raw(wi, org_url, project)
        for wi in raw_items
        if is_deploy_relevant_type(wi.get('fields', {}).get('System.WorkItemType', ''))
        and not is_excluded_deploy_type(wi.get('fields', {}).get('System.WorkItemType', ''))
    ]
