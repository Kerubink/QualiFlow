"""Test Cases do Azure DevOps: criacao/atualizacao (XML de passos) e leitura dos casos vinculados a um card.
"""
import requests

from ...domain.assignee import is_valid_assignee
from ...domain.test_case_xml import (
    format_local_data_source_xml,
    format_parameters_xml,
    parse_test_steps_xml,
    steps_to_xml,
)
from .http import read_headers, write_headers


def create_test_case(access_token, org_url, project, item, parent_data=None):
    """Cria um novo Test Case no Azure."""
    headers = write_headers(access_token, 'application/json-patch+json')
    url = f'{org_url}/{project}/_apis/wit/workitems/$Test Case?api-version=7.1'

    tags = parent_data.get('tags', '') if parent_data else ''

    patch = [
        {'op': 'add', 'path': '/fields/System.Title', 'value': item.get('title', '')},
        {'op': 'add', 'path': '/fields/Microsoft.VSTS.TCM.Steps', 'value': steps_to_xml(item.get('steps', []))},
        {'op': 'add', 'path': '/fields/Custom.Gherkin', 'value': item.get('bdd_description', '')}
    ]

    if item.get('parameters') and len(item['parameters']) > 0:
        patch.append({
            'op': 'add',
            'path': '/fields/Microsoft.VSTS.TCM.Parameters',
            'value': format_parameters_xml(item['parameters'])
        })
        patch.append({
            'op': 'add',
            'path': '/fields/Microsoft.VSTS.TCM.LocalDataSource',
            'value': format_local_data_source_xml(item['parameters'])
        })

    if parent_data and parent_data.get('areaPath'):
        patch.append({'op': 'add', 'path': '/fields/System.AreaPath', 'value': parent_data['areaPath']})

    if parent_data and parent_data.get('iterationPath'):
        patch.append({'op': 'add', 'path': '/fields/System.IterationPath', 'value': parent_data['iterationPath']})

    if tags:
        patch.append({'op': 'add', 'path': '/fields/System.Tags', 'value': tags})

    if is_valid_assignee(item.get('assignedTo')):
        patch.append({'op': 'add', 'path': '/fields/System.AssignedTo', 'value': str(item['assignedTo']).strip()})

    if parent_data and parent_data.get('id'):
        patch.append({
            'op': 'add',
            'path': '/relations/-',
            'value': {
                'rel': 'Microsoft.VSTS.Common.TestedBy-Reverse',
                'url': f'{org_url}/_apis/wit/workItems/{parent_data["id"]}',
                'attributes': {'comment': 'Gerado pelo QualiFlow'}
            }
        })

    response = requests.post(url, headers=headers, json=patch, timeout=30)
    if not response.ok:
        error_body = response.text
        raise RuntimeError(
            f'Falha ao criar teste no Azure ({response.status_code} {response.reason}). '
            f'Verifique: (1) PAT tem permissao full-access? (2) Organizacao/Projeto corretos? '
            f'Erro: {error_body[:100]}'
        )
    return response.json()


def update_test_case(access_token, org_url, project, item, parent_data=None):
    """Atualiza um Test Case existente no Azure."""
    headers = write_headers(access_token, 'application/json-patch+json')
    url = f'{org_url}/{project}/_apis/wit/workitems/{item.get("id_original")}?api-version=7.1'
    tags = parent_data.get('tags', '') if parent_data else ''

    patch = [
        {'op': 'replace', 'path': '/fields/System.Title', 'value': item.get('title', '')},
        {'op': 'add', 'path': '/fields/Microsoft.VSTS.TCM.Steps', 'value': steps_to_xml(item.get('steps', []))},
        {'op': 'add', 'path': '/fields/Custom.Gherkin', 'value': item.get('bdd_description', '')}
    ]

    if item.get('parameters') and len(item['parameters']) > 0:
        patch.append({
            'op': 'add',
            'path': '/fields/Microsoft.VSTS.TCM.Parameters',
            'value': format_parameters_xml(item['parameters'])
        })
        patch.append({
            'op': 'add',
            'path': '/fields/Microsoft.VSTS.TCM.LocalDataSource',
            'value': format_local_data_source_xml(item['parameters'])
        })

    if tags:
        patch.append({'op': 'add', 'path': '/fields/System.Tags', 'value': tags})

    if is_valid_assignee(item.get('assignedTo')):
        patch.append({'op': 'add', 'path': '/fields/System.AssignedTo', 'value': str(item['assignedTo']).strip()})

    response = requests.patch(url, headers=headers, json=patch, timeout=30)
    if not response.ok:
        error_body = response.text
        raise RuntimeError(
            f'Falha ao atualizar teste {item.get("id_original")} no Azure ({response.status_code} {response.reason}). '
            f'Verifique se o teste ainda existe e PAT tem permissao. '
            f'Erro: {error_body[:100]}'
        )
    return response.json()


def get_test_cases_for_work_item(access_token, org_url, project, work_item_id):
    """Busca Test Cases associados a um Work Item."""
    headers = read_headers(access_token)

    wi_url = f'{org_url}/{project}/_apis/wit/workitems/{work_item_id}?$expand=relations&api-version=7.1'
    wi_response = requests.get(wi_url, headers=headers, timeout=30)

    if not wi_response.ok:
        raise RuntimeError(f'Falha ao buscar Work Item {work_item_id}: {wi_response.status_code}')

    wi_data = wi_response.json()
    relations = wi_data.get('relations', [])

    test_case_ids = []
    for rel in relations:
        rel_type = rel.get('rel', '')
        if rel_type and 'TestedBy' in rel_type:
            try:
                tc_id = int(rel['url'].split('/')[-1])
                test_case_ids.append(tc_id)
            except (ValueError, IndexError):
                pass

    if not test_case_ids:
        return []

    ids_param = ','.join(map(str, test_case_ids))
    tc_url = f'{org_url}/{project}/_apis/wit/workitems?ids={ids_param}&fields=System.Id,System.Title,System.State,Microsoft.VSTS.TCM.Steps&api-version=7.1'
    tc_response = requests.get(tc_url, headers=headers, timeout=30)

    if not tc_response.ok:
        raise RuntimeError(f'Falha ao buscar Test Cases: {tc_response.status_code}')

    tc_data = tc_response.json()

    result = []
    for tc in tc_data.get('value', []):
        steps_xml = tc.get('fields', {}).get('Microsoft.VSTS.TCM.Steps', '')
        steps = parse_test_steps_xml(steps_xml)
        result.append({
            'id': tc['id'],
            'title': tc.get('fields', {}).get('System.Title', f'Caso de Teste #{tc["id"]}'),
            'state': tc.get('fields', {}).get('System.State', ''),
            'steps': steps
        })

    return result
