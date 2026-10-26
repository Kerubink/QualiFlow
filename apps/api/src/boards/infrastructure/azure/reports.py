"""Consultas agregadas do Azure DevOps (dashboard QA e analytics de Test Cases com card pai).
"""
import requests

from .http import read_headers


def get_qa_dashboard(access_token, org_url, project):
    """Busca dashboard QA com trabalhos e testes associados."""
    headers = read_headers(access_token)

    wiql_url = f'{org_url}/{project}/_apis/wit/wiql?api-version=7.1'
    query = f"""
        SELECT [System.Id]
        FROM workitems
        WHERE [System.TeamProject] = '{project}'
        AND [System.WorkItemType] <> 'Test Case'
        ORDER BY [System.ChangedDate] DESC
    """

    wiql_response = requests.post(wiql_url, headers=headers, json={'query': query}, timeout=60)
    if not wiql_response.ok:
        raise RuntimeError(f'Falha ao executar WIQL: {wiql_response.status_code}')

    wiql_data = wiql_response.json()
    work_items = wiql_data.get('workItems', [])

    if not work_items:
        return []

    selected_ids = [wi['id'] for wi in work_items[:400]]
    project_items = []

    for i in range(0, len(selected_ids), 120):
        chunk = selected_ids[i:i+120]
        if not chunk:
            continue

        details_url = f'{org_url}/{project}/_apis/wit/workitems?ids={",".join(map(str, chunk))}&$expand=relations&api-version=7.1'
        details_response = requests.get(details_url, headers=headers, timeout=60)

        if not details_response.ok:
            continue

        details_data = details_response.json()
        project_items.extend(details_data.get('value', []))

    if not project_items:
        raise RuntimeError('Falha ao buscar detalhes dos Work Items em lotes.')

    all_tc_ids = []
    for wi in project_items:
        wi['testCases'] = []
        if wi.get('relations'):
            for rel in wi['relations']:
                rel_type = rel.get('rel', '')
                if rel_type and ('TestedBy' in rel_type or 'Tests' in rel_type):
                    try:
                        t_id = int(rel['url'].split('/')[-1])
                        if t_id not in all_tc_ids:
                            all_tc_ids.append(t_id)
                        wi['testCases'].append({'id': t_id})
                    except (ValueError, IndexError):
                        pass

    if all_tc_ids:
        tc_map = {}
        unique_ids = list(set(all_tc_ids))
        for i in range(0, len(unique_ids), 150):
            chunk = unique_ids[i:i+150]
            tc_url = f'{org_url}/{project}/_apis/wit/workitems?ids={",".join(map(str, chunk))}&api-version=7.1'
            tc_response = requests.get(tc_url, headers=headers, timeout=60)
            if not tc_response.ok:
                continue

            tc_data = tc_response.json()
            for tc in tc_data.get('value', []):
                assigned_to = tc.get('fields', {}).get('System.AssignedTo')
                if isinstance(assigned_to, dict):
                    assigned_to_str = assigned_to.get('displayName') or assigned_to.get('uniqueName') or assigned_to.get('name') or ''
                else:
                    assigned_to_str = assigned_to or ''

                tc_map[tc['id']] = {
                    'id': tc['id'],
                    'title': tc.get('fields', {}).get('System.Title') or f'Sem titulo ({tc["id"]})',
                    'state': tc.get('fields', {}).get('System.State', ''),
                    'tags': tc.get('fields', {}).get('System.Tags', ''),
                    'assignedTo': assigned_to_str,
                    'url': tc.get('_links', {}).get('html', {}).get('href') or f'{org_url}/{project}/_workitems/edit/{tc["id"]}'
                }

        for wi in project_items:
            valid_tcs = []
            for tc in wi.get('testCases', []):
                if tc['id'] in tc_map:
                    valid_tcs.append(tc_map[tc['id']])
            wi['testCases'] = valid_tcs

    linked_test_ids = set()
    for wi in project_items:
        for tc in wi.get('testCases', []):
            if tc.get('id'):
                linked_test_ids.add(tc['id'])

    records = []
    for wi in project_items:
        records.append({
            'id': wi['id'],
            'title': wi.get('fields', {}).get('System.Title') or f'Sem titulo ({wi["id"]})',
            'type': wi.get('fields', {}).get('System.WorkItemType', ''),
            'state': wi.get('fields', {}).get('System.State', ''),
            'tags': wi.get('fields', {}).get('System.Tags', ''),
            'iterationPath': wi.get('fields', {}).get('System.IterationPath', 'Desconhecido'),
            'url': wi.get('_links', {}).get('html', {}).get('href') or f'{org_url}/{project}/_workitems/edit/{wi["id"]}',
            'testCases': wi.get('testCases', [])
        })

    standalone_test_case_records = []
    tc_query = f"""
        SELECT [System.Id]
        FROM workitems
        WHERE [System.TeamProject] = '{project}'
        AND [System.WorkItemType] = 'Test Case'
        ORDER BY [System.ChangedDate] DESC
    """

    tc_wiql_response = requests.post(wiql_url, headers=headers, json={'query': tc_query}, timeout=60)

    if tc_wiql_response.ok:
        tc_wiql_data = tc_wiql_response.json()
        tc_ids = [wi['id'] for wi in tc_wiql_data.get('workItems', [])[:500]]

        for i in range(0, len(tc_ids), 120):
            chunk = tc_ids[i:i+120]
            if not chunk:
                continue

            tc_details_url = f'{org_url}/{project}/_apis/wit/workitems?ids={",".join(map(str, chunk))}&api-version=7.1'
            tc_details_response = requests.get(tc_details_url, headers=headers, timeout=60)

            if not tc_details_response.ok:
                continue

            tc_details_data = tc_details_response.json()
            for wi in tc_details_data.get('value', []):
                if wi['id'] in linked_test_ids:
                    continue

                assigned_to = wi.get('fields', {}).get('System.AssignedTo')
                if isinstance(assigned_to, dict):
                    assigned_to_str = assigned_to.get('displayName') or assigned_to.get('uniqueName') or assigned_to.get('name') or ''
                else:
                    assigned_to_str = assigned_to or ''

                test_case = {
                    'id': wi['id'],
                    'title': wi.get('fields', {}).get('System.Title') or f'Sem titulo ({wi["id"]})',
                    'state': wi.get('fields', {}).get('System.State', ''),
                    'tags': wi.get('fields', {}).get('System.Tags', ''),
                    'assignedTo': assigned_to_str,
                    'url': wi.get('_links', {}).get('html', {}).get('href') or f'{org_url}/{project}/_workitems/edit/{wi["id"]}'
                }

                standalone_test_case_records.append({
                    'id': wi['id'],
                    'title': f'[TC] {test_case["title"]}',
                    'type': 'Test Case',
                    'state': test_case['state'],
                    'tags': test_case['tags'],
                    'iterationPath': wi.get('fields', {}).get('System.IterationPath', 'Desconhecido'),
                    'url': test_case['url'],
                    'testCases': [test_case]
                })

    return {
        'items': records + standalone_test_case_records,
        'meta': {
            'parentCardsLoaded': len(records),
            'linkedTestsLoaded': len(linked_test_ids),
            'standaloneTestsLoaded': len(standalone_test_case_records),
            'totalItemsReturned': len(records) + len(standalone_test_case_records)
        }
    }


def get_test_case_analytics(access_token, org_url, project):
    """Busca analytics de Test Cases com relacoes de parentesco."""
    headers = read_headers(access_token)

    wiql_url = f'{org_url}/{project}/_apis/wit/wiql?api-version=7.1'

    tc_query = f"""
        SELECT [System.Id]
        FROM workitems
        WHERE [System.TeamProject] = '{project}'
        AND [System.WorkItemType] = 'Test Case'
        ORDER BY [System.ChangedDate] DESC
    """

    tc_wiql_response = requests.post(wiql_url, headers=headers, json={'query': tc_query}, timeout=60)

    if not tc_wiql_response.ok:
        raise RuntimeError(f'Falha ao executar WIQL de Test Case: {tc_wiql_response.status_code}')

    tc_wiql_data = tc_wiql_response.json()
    all_tc_ids = [wi['id'] for wi in tc_wiql_data.get('workItems', [])]
    tc_ids = all_tc_ids

    if not tc_ids:
        return {
            'items': [],
            'meta': {
                'testCasesLoaded': 0,
                'parentLinksDetected': 0,
                'parentsResolved': 0,
                'limitApplied': None,
                'totalTestCasesAvailable': len(all_tc_ids),
                'truncatedByLimit': False
            }
        }

    test_cases = []
    parent_ids = set()

    for i in range(0, len(tc_ids), 120):
        chunk = tc_ids[i:i+120]
        tc_url = f'{org_url}/{project}/_apis/wit/workitems?ids={",".join(map(str, chunk))}&$expand=relations&api-version=7.1'
        tc_response = requests.get(tc_url, headers=headers, timeout=60)
        if not tc_response.ok:
            continue

        tc_data = tc_response.json()
        for wi in tc_data.get('value', []):
            fields = wi.get('fields', {})
            relations = wi.get('relations', [])
            parent_candidates = []

            for rel in relations:
                rel_type = str(rel.get('rel', ''))
                if 'Reverse' not in rel_type:
                    continue
                try:
                    parent_id = int(rel['url'].split('/')[-1])
                    parent_candidates.append(parent_id)
                    parent_ids.add(parent_id)
                except (ValueError, IndexError):
                    pass

            assigned_to = fields.get('System.AssignedTo')
            if isinstance(assigned_to, dict):
                assigned_to_str = assigned_to.get('displayName') or assigned_to.get('uniqueName') or assigned_to.get('name') or ''
            else:
                assigned_to_str = assigned_to or ''

            test_cases.append({
                'id': wi['id'],
                'title': fields.get('System.Title', f'Sem titulo ({wi["id"]})'),
                'state': fields.get('System.State', ''),
                'tags': fields.get('System.Tags', ''),
                'iterationPath': fields.get('System.IterationPath', 'Desconhecido'),
                'assignedTo': assigned_to_str,
                'url': wi.get('_links', {}).get('html', {}).get('href') or f'{org_url}/{project}/_workitems/edit/{wi["id"]}',
                'parentCandidates': parent_candidates
            })

    parent_map = {}
    parent_ids_list = list(parent_ids)
    for i in range(0, len(parent_ids_list), 120):
        chunk = parent_ids_list[i:i+120]
        if not chunk:
            continue
        parent_url = f'{org_url}/{project}/_apis/wit/workitems?ids={",".join(map(str, chunk))}&api-version=7.1'
        parent_response = requests.get(parent_url, headers=headers, timeout=60)
        if not parent_response.ok:
            continue

        parent_data = parent_response.json()
        for wi in parent_data.get('value', []):
            fields = wi.get('fields', {})
            parent_map[wi['id']] = {
                'id': wi['id'],
                'title': fields.get('System.Title', f'Sem titulo ({wi["id"]})'),
                'type': fields.get('System.WorkItemType', 'Sem tipo'),
                'state': fields.get('System.State', ''),
                'tags': fields.get('System.Tags', ''),
                'iterationPath': fields.get('System.IterationPath', 'Desconhecido'),
                'url': wi.get('_links', {}).get('html', {}).get('href') or f'{org_url}/{project}/_workitems/edit/{wi["id"]}'
            }

    items = []
    for tc in test_cases:
        parent = None
        for pid in tc['parentCandidates']:
            if pid in parent_map:
                parent = parent_map[pid]
                break

        items.append({
            'id': tc['id'],
            'title': tc['title'],
            'state': tc['state'],
            'tags': tc['tags'],
            'iterationPath': tc['iterationPath'],
            'assignedTo': tc['assignedTo'],
            'url': tc['url'],
            'parentId': parent['id'] if parent else None,
            'parentTitle': parent['title'] if parent else 'Sem card pai vinculado',
            'parentType': parent['type'] if parent else 'Sem tipo',
            'parentState': parent['state'] if parent else '',
            'parentTags': parent['tags'] if parent else '',
            'parentIterationPath': parent['iterationPath'] if parent else tc['iterationPath'],
            'parentUrl': parent['url'] if parent else None
        })

    return {
        'items': items,
        'meta': {
            'testCasesLoaded': len(items),
            'parentLinksDetected': sum(len(tc['parentCandidates']) for tc in test_cases),
            'parentsResolved': len(parent_map),
            'limitApplied': None,
            'totalTestCasesAvailable': len(all_tc_ids),
            'truncatedByLimit': False
        }
    }
