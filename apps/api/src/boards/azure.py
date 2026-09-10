"""Servico de integracao com Azure DevOps via API REST.

Implementacao de chamadas HTTP para trabalhar com Work Items, Test Cases,
Test Runs, e validacao de deployment. Autenticacao via OAuth Bearer token
(Microsoft Entra ID).
"""
import re
import requests


def azure_get_work_item(access_token, org_url, project, work_item_id):
    """Busca um Work Item com todas suas relacoes e testes existentes."""
    headers = {
        'Authorization': f'Bearer {access_token}',
        'Accept': 'application/json'
    }
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


def format_parameters_xml(parameters):
    """Formata parametros para XML de Test Case."""
    if not parameters or len(parameters) == 0:
        return ""
    xml = '<parameters>'
    for name in parameters.keys():
        clean_name = name[1:] if name.startswith('@') else name
        xml += f'<param name="{clean_name}" bind="default"/>'
    xml += '</parameters>'
    return xml


def format_local_data_source_xml(parameters):
    """Formata Data Source local para XML de Test Case."""
    if not parameters or len(parameters) == 0:
        return ""
    
    clean_params = {}
    for k, v in parameters.items():
        clean_name = k[1:] if k.startswith('@') else k
        clean_params[clean_name] = v or ''
    
    col_defs = ''.join(
        f'<xs:element name="{name}" type="xs:string" minOccurs="0" />'
        for name in clean_params.keys()
    )
    
    row_values = ''.join(
        f'<{name}>{val}</{name}>'
        for name, val in clean_params.items()
    )
    
    return (
        '<NewDataSet>' +
        '<xs:schema id="NewDataSet" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:msdata="urn:schemas-microsoft-com:xml-msdata">' +
        '<xs:element name="NewDataSet" msdata:IsDataSet="true" msdata:Locale="">' +
        '<xs:complexType><xs:choice minOccurs="0" maxOccurs="unbounded">' +
        '<xs:element name="Table1"><xs:complexType><xs:sequence>' +
        col_defs +
        '</xs:sequence></xs:complexType></xs:element>' +
        '</xs:choice></xs:complexType></xs:element>' +
        '</xs:schema>' +
        '<diffgr:diffgram xmlns:msdata="urn:schemas-microsoft-com:xml-msdata" xmlns:diffgr="urn:schemas-microsoft-com:xml-diffgram-v1">' +
        '<NewDataSet><Table1 diffgr:id="Table11" msdata:rowOrder="0">' +
        row_values +
        '</Table1></NewDataSet>' +
        '</diffgr:diffgram>' +
        '</NewDataSet>'
    )


def extract_scenario_params(item):
    """Extrai parametros (@variaveis) mencionados no cenario."""
    text_to_scan = f"{item.get('title', '')} {item.get('bdd_description', '')} "
    steps = item.get('steps', [])
    text_to_scan += ' '.join(
        f"{s.get('action', '')} {s.get('expected', '')}" for s in steps
    )
    matches = re.findall(r'@\w+', text_to_scan)
    return list(set(m.strip() for m in matches))


def ensure_scenario_params_default(item):
    """Garante que todos os parametros extraidos tenham valor padrao."""
    param_names = extract_scenario_params(item)
    if len(param_names) == 0:
        return
    
    if 'parameters' not in item or item['parameters'] is None:
        item['parameters'] = {}
    
    for pname in param_names:
        if pname not in item['parameters'] or not item['parameters'][pname].strip():
            item['parameters'][pname] = '###'


def is_valid_azure_assignee(value):
    """Valida se value e um identificador valido de assignee no Azure."""
    if not value:
        return False
    trimmed = str(value).strip()
    if not trimmed:
        return False
    
    email_pattern = r'^[^\s@]+@[^\s@]+\.[^\s@]+$'
    domain_user_pattern = r'^[^\\s]+\\[^\\s]+$'
    
    return bool(re.match(email_pattern, trimmed)) or bool(re.match(domain_user_pattern, trimmed))


def steps_to_xml(steps_array):
    """Converte array de passos em XML de Test Case do Azure."""
    def escape_xml(unsafe):
        if not unsafe:
            return ''
        unsafe = str(unsafe)
        unsafe = unsafe.replace('&', '&amp;')
        unsafe = unsafe.replace('<', '&lt;')
        unsafe = unsafe.replace('>', '&gt;')
        unsafe = unsafe.replace("'", '&apos;')
        unsafe = unsafe.replace('"', '&quot;')
        return unsafe
    
    xml = f'<steps id="0" last="{len(steps_array)}">'
    for idx, step in enumerate(steps_array):
        action_text = step.get('action', '')
        if step.get('needs_evidence'):
            action_text = f'📸 [EVIDÊNCIA OBRIGATÓRIA] {action_text}'
        
        xml += (
            f'\n  <step id="{idx + 1}" type="ValidateStep">'
            f'\n    <parameterizedString isformatted="true">{escape_xml(action_text)}</parameterizedString>'
            f'\n    <parameterizedString isformatted="true">{escape_xml(step.get("expected", ""))}</parameterizedString>'
            f'\n    <description/>'
            f'\n  </step>'
        )
    xml += '</steps>'
    return xml


def azure_create_test_case(access_token, org_url, project, item, parent_data=None):
    """Cria um novo Test Case no Azure."""
    headers = {
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/json-patch+json'
    }
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
    
    if is_valid_azure_assignee(item.get('assignedTo')):
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


def azure_update_test_case(access_token, org_url, project, item, parent_data=None):
    """Atualiza um Test Case existente no Azure."""
    headers = {
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/json-patch+json'
    }
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
    
    if is_valid_azure_assignee(item.get('assignedTo')):
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


def azure_get_qa_dashboard(access_token, org_url, project):
    """Busca dashboard QA com trabalhos e testes associados."""
    headers = {
        'Authorization': f'Bearer {access_token}',
        'Accept': 'application/json'
    }
    
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


def azure_get_test_case_analytics(access_token, org_url, project):
    """Busca analytics de Test Cases com relacoes de parentesco."""
    headers = {
        'Authorization': f'Bearer {access_token}',
        'Accept': 'application/json'
    }
    
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


def azure_update_work_items_state(access_token, org_url, project, ids, new_state):
    """Atualiza estado de multiplos Work Items."""
    headers = {
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/json-patch+json'
    }
    
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


def azure_get_test_runner_cards(access_token, org_url, project, search_query=None):
    """Busca cards para execucao de testes com filtro opcional."""
    headers = {
        'Authorization': f'Bearer {access_token}',
        'Accept': 'application/json'
    }
    
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


def azure_get_support_cards(access_token, org_url, project):
    """Busca cards de Sustentacao."""
    headers = {
        'Authorization': f'Bearer {access_token}',
        'Accept': 'application/json'
    }
    
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


def azure_get_test_cases_for_work_item(access_token, org_url, project, work_item_id):
    """Busca Test Cases associados a um Work Item."""
    headers = {
        'Authorization': f'Bearer {access_token}',
        'Accept': 'application/json'
    }
    
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
        steps = _parse_test_steps_xml(steps_xml)
        result.append({
            'id': tc['id'],
            'title': tc.get('fields', {}).get('System.Title', f'Caso de Teste #{tc["id"]}'),
            'state': tc.get('fields', {}).get('System.State', ''),
            'steps': steps
        })
    
    return result


def _parse_test_steps_xml(xml):
    """Parse XML de passos de Test Case extraindo acoes e resultados esperados."""
    if not xml:
        return []
    
    try:
        steps = []
        step_pattern = r'<step([^>]*?)>([\s\S]*?)<\/step>'
        order = 1
        
        for step_match in re.finditer(step_pattern, xml, re.IGNORECASE):
            step_attr = step_match.group(1)
            step_content = step_match.group(2)
            
            id_match = re.search(r'id="([^"]+)"', step_attr, re.IGNORECASE)
            step_id = id_match.group(1) if id_match else str(order)
            
            strings = []
            string_pattern = r'<parameterizedString[^>]*>([\s\S]*?)<\/parameterizedString>'
            for str_match in re.finditer(string_pattern, step_content, re.IGNORECASE):
                text = re.sub(r'<[^>]+>', '', str_match.group(1)).strip()
                strings.append(text)
            
            action = strings[0] if len(strings) > 0 else ''
            expected = strings[1] if len(strings) > 1 else ''
            
            if action:
                steps.append({'order': order, 'stepId': step_id, 'action': action, 'expected': expected})
                order += 1
        
        return steps
    except Exception:
        return []


def azure_get_test_points_for_test_cases(access_token, org_url, project, test_case_ids):
    """Resolve Test Points para Test Cases em Plans/Suites."""
    headers = {
        'Authorization': f'Bearer {access_token}',
        'Accept': 'application/json'
    }
    
    point_map = {}
    tc_id_set = set(int(tcid) for tcid in test_case_ids)
    
    try:
        plans_url = f'{org_url}/{project}/_apis/testplan/Plans?filterActivePlans=true&api-version=7.2-preview'
        plans_resp = requests.get(plans_url, headers=headers, timeout=30)
        if not plans_resp.ok:
            return []
        
        plans = sorted(
            plans_resp.json().get('value', []),
            key=lambda p: p.get('id', 0),
            reverse=True
        )[:3]
        
        for plan in plans:
            if len(point_map) == len(test_case_ids):
                break
            
            suites_url = f'{org_url}/{project}/_apis/testplan/Plans/{plan["id"]}/Suites?api-version=7.2-preview'
            suites_resp = requests.get(suites_url, headers=headers, timeout=30)
            if not suites_resp.ok:
                continue
            
            suites = suites_resp.json().get('value', [])
            
            for suite in suites:
                if len(point_map) == len(test_case_ids):
                    break
                
                pt_url = f'{org_url}/{project}/_apis/testplan/Plans/{plan["id"]}/Suites/{suite["id"]}/TestPoint?api-version=7.2-preview'
                pt_resp = requests.get(pt_url, headers=headers, timeout=30)
                if not pt_resp.ok:
                    continue
                
                pts = pt_resp.json().get('value', [])
                if not pts:
                    continue
                
                for pt in pts:
                    tc_id = None
                    for candidate_field in ['testCase', 'testCaseReference', 'workItem', 'testCaseId']:
                        if candidate_field in pt:
                            if isinstance(pt[candidate_field], dict) and 'id' in pt[candidate_field]:
                                tc_id = int(pt[candidate_field]['id'])
                            elif isinstance(pt[candidate_field], int):
                                tc_id = pt[candidate_field]
                            if tc_id:
                                break
                    
                    if tc_id and tc_id in tc_id_set and tc_id not in point_map:
                        point_map[tc_id] = {
                            'pointId': pt['id'],
                            'planId': plan['id'],
                            'suiteId': suite['id']
                        }
    except Exception:
        pass
    
    result = []
    for test_case_id in test_case_ids:
        if test_case_id in point_map:
            result.append({
                'testCaseId': test_case_id,
                **point_map[test_case_id]
            })
    
    return result


def azure_add_adhoc_test_results(access_token, org_url, project, run_id, test_case_ids):
    """Adiciona resultados Ad-Hoc de testes a um Test Run."""
    headers = {
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/json'
    }
    
    body = [
        {
            'testCaseId': int(tc_id),
            'testCaseTitle': f'Execucao QualiFlow CT {tc_id}',
            'outcome': 'InProgress',
            'state': 'InProgress'
        }
        for tc_id in test_case_ids
    ]
    
    url = f'{org_url}/{project}/_apis/test/runs/{run_id}/results?api-version=7.1'
    resp = requests.post(url, headers=headers, json=body, timeout=30)
    
    if not resp.ok:
        raise RuntimeError(f'Falha ao adicionar resultados Ad-Hoc: {resp.text}')
    
    data = resp.json()
    return data.get('value', [])


def azure_create_test_run(access_token, org_url, project, title, plan_id=None, point_ids=None):
    """Cria um novo Test Run."""
    headers = {
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/json'
    }
    
    body = {
        'name': title,
        'isAutomated': False
    }
    
    if plan_id:
        body['plan'] = {'id': plan_id}
    if point_ids and len(point_ids) > 0:
        body['pointIds'] = point_ids
    
    url = f'{org_url}/{project}/_apis/test/runs?api-version=7.1'
    resp = requests.post(url, headers=headers, json=body, timeout=30)
    
    if not resp.ok:
        raise RuntimeError(f'Falha ao criar Test Run: {resp.text}')
    
    data = resp.json()
    return data.get('id')


def azure_get_run_results(access_token, org_url, project, run_id):
    """Busca resultados de um Test Run."""
    headers = {
        'Authorization': f'Bearer {access_token}',
        'Accept': 'application/json'
    }
    
    url = f'{org_url}/{project}/_apis/test/runs/{run_id}/results?api-version=7.1'
    resp = requests.get(url, headers=headers, timeout=30)
    if not resp.ok:
        raise RuntimeError(f'Falha ao buscar resultados do Run: {resp.status_code}')
    
    data = resp.json()
    return data.get('value', [])


def azure_update_test_result(access_token, org_url, project, run_id, result_id, outcome, comment=None, step_results=None):
    """Atualiza resultado de um teste em um Test Run."""
    headers = {
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/json'
    }
    
    iteration_details = None
    if step_results and len(step_results) > 0:
        action_results = []
        for idx, s in enumerate(step_results):
            step_id = str(s.get('stepId', idx + 1))
            action_path = ''
            
            try:
                num = int(step_id)
                action_path = format(num, '08x')
            except ValueError:
                parts = step_id.split(';')
                hex_parts = []
                for part in parts:
                    try:
                        p_num = int(part)
                        hex_parts.append(format(p_num, '08x'))
                    except ValueError:
                        hex_parts.append(part)
                action_path = ''.join(hex_parts)
            
            action_results.append({
                'stepIdentifier': step_id,
                'actionPath': action_path,
                'iterationId': 1,
                'outcome': s.get('outcome', ''),
                'errorMessage': s.get('comment', '')
            })
        
        iteration_details = [{
            'id': 1,
            'actionResults': action_results,
            'outcome': outcome
        }]
    
    body = [{
        'id': result_id,
        'outcome': outcome,
        'comment': comment or '',
        'state': 'Completed'
    }]
    
    if iteration_details:
        body[0]['iterationDetails'] = iteration_details
    
    url = f'{org_url}/{project}/_apis/test/runs/{run_id}/results?api-version=7.1'
    resp = requests.patch(url, headers=headers, json=body, timeout=30)
    
    if not resp.ok:
        raise RuntimeError(f'Falha ao atualizar resultado: {resp.text}')
    
    return True


def azure_complete_test_run(access_token, org_url, project, run_id, state):
    """Marca um Test Run como concluido."""
    headers = {
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/json'
    }
    
    url = f'{org_url}/{project}/_apis/test/runs/{run_id}?api-version=7.1'
    resp = requests.patch(url, headers=headers, json={'state': state}, timeout=30)
    if not resp.ok:
        raise RuntimeError(f'Falha ao concluir run: {resp.status_code}')
    
    return True


def azure_create_bug_from_failure(access_token, org_url, project, title, comment, test_case_id=None, linked_work_item_id=None):
    """Cria um Bug a partir de uma falha em teste."""
    headers = {
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/json-patch+json'
    }
    
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


def azure_add_attachment(access_token, org_url, project, run_id, result_id, file_name, base64_content, comment=None):
    """Adiciona um anexo a um resultado de teste."""
    headers = {
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/json'
    }
    
    url = f'{org_url}/{project}/_apis/test/runs/{run_id}/results/{result_id}/attachments?api-version=7.1'
    body = {
        'attachmentType': 'GeneralAttachment',
        'comment': comment or '',
        'fileName': file_name,
        'stream': base64_content
    }
    
    resp = requests.post(url, headers=headers, json=body, timeout=30)
    
    if not resp.ok:
        raise RuntimeError(f'Falha ao enviar anexo: {resp.text}')
    
    return resp.json()


def azure_get_project_iterations(access_token, org_url, project):
    """Busca iteracoes disponiveis do projeto."""
    headers = {
        'Authorization': f'Bearer {access_token}',
        'Accept': 'application/json'
    }
    
    url = f'{org_url}/{project}/_apis/wit/classificationnodes/iterations?$depth=10&api-version=7.1'
    response = requests.get(url, headers=headers, timeout=30)
    
    if response.ok:
        data = response.json()
        iterations = _flatten_iteration_nodes(data)
        iterations = [
            i for i in iterations if not i.get('hasChildren', False)
        ]
        
        def extract_iteration_number(name):
            match = re.search(r'\d+', name)
            return int(match.group(0)) if match else 0
        
        iterations.sort(key=lambda it: (-extract_iteration_number(it['name']), it['path']))
        
        if iterations:
            return [{'name': it['name'], 'path': _normalize_iteration_path(it['path'], project)} for it in iterations]
    
    raise RuntimeError('Nao foi possivel carregar iteracoes. Verifique a configuracao do projeto.')


def _flatten_iteration_nodes(node, acc=None):
    """Recursivamente flatten nodes de iteracoes."""
    if acc is None:
        acc = []
    
    if not node:
        return acc
    
    if node.get('path') or node.get('structureType') == 'iteration':
        raw_path = node.get('path', '')
        clean_path = _normalize_iteration_path(raw_path)
        if clean_path and node.get('structureType') == 'iteration':
            acc.append({
                'name': node.get('name') or clean_path.split('\\')[-1],
                'path': clean_path,
                'hasChildren': bool(node.get('hasChildren') or (node.get('children') and len(node['children']) > 0))
            })
    
    if node.get('children') and isinstance(node['children'], list):
        for child in node['children']:
            _flatten_iteration_nodes(child, acc)
    
    return acc


def _normalize_iteration_path(path, azure_project=''):
    """Normaliza caminho de iteracao removendo prefixos."""
    clean_path = str(path or '').lstrip('\\')
    if not clean_path:
        return clean_path
    
    parts = [p for p in clean_path.split('\\') if p]
    if len(parts) >= 3:
        root, maybe_iteration = parts[0], parts[1]
        if azure_project and root == azure_project and maybe_iteration.lower() == 'iteration':
            return '\\'.join([root] + parts[2:])
    
    return clean_path


def azure_get_deploy_validation(access_token, org_url, project, iteration_path):
    """Busca validacao de deploy para iteracao especificada."""
    if not iteration_path:
        raise RuntimeError('Iteration/Sprint nao informada.')
    
    headers = {
        'Authorization': f'Bearer {access_token}',
        'Accept': 'application/json'
    }
    
    iteration_path = _normalize_iteration_path(iteration_path, project)
    
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
        detail = _read_azure_error_detail(wiql_response)
        raise RuntimeError(f'Falha ao buscar cards da sprint: {detail}')
    
    wiql_data = wiql_response.json()
    sprint_ids = [w['id'] for w in wiql_data.get('workItems', [])]
    
    if not sprint_ids:
        return {
            'iterationPath': iteration_path,
            'items': [],
            'summary': {'total': 0, 'liberados': 0, 'problemas': 0, 'pendentes': 0}
        }
    
    raw_items = []
    for i in range(0, len(sprint_ids), 200):
        chunk = sprint_ids[i:i+200]
        chunk_items = _azure_fetch_work_items_by_ids(access_token, org_url, project, chunk)
        raw_items.extend(chunk_items)
    
    mapped = [
        _map_work_item_raw(wi, org_url, project)
        for wi in raw_items
        if _is_deploy_relevant_type(wi.get('fields', {}).get('System.WorkItemType', ''))
        and not _is_excluded_deploy_type(wi.get('fields', {}).get('System.WorkItemType', ''))
    ]
    
    if not mapped:
        return {
            'iterationPath': iteration_path,
            'items': [],
            'summary': {'total': 0, 'liberados': 0, 'problemas': 0, 'pendentes': 0}
        }
    
    by_id = {m['id']: m for m in mapped}
    children_of = {}
    parent_of = {}
    
    for item in mapped:
        for rel in item.get('_relations', []):
            if _is_hierarchy_child_rel(rel):
                child_id = _relation_id(rel)
                if not child_id or child_id not in by_id:
                    continue
                child = by_id[child_id]
                if not _is_deploy_child_type(child['type']):
                    continue
                if item['id'] not in children_of:
                    children_of[item['id']] = []
                if child_id not in children_of[item['id']]:
                    children_of[item['id']].append(child_id)
                parent_of[child_id] = item['id']
            
            if _is_hierarchy_parent_rel(rel):
                parent_id = _relation_id(rel)
                if parent_id:
                    parent_of[item['id']] = parent_id
    
    for item in mapped:
        if not _is_deploy_child_type(item['type']):
            continue
        parent_id = parent_of.get(item['id'])
        if parent_id and parent_id in by_id and _is_deploy_parent_type(by_id[parent_id]['type']):
            if parent_id not in children_of:
                children_of[parent_id] = []
            if item['id'] not in children_of[parent_id]:
                children_of[parent_id].append(item['id'])
    
    def build_validated_node(item):
        def build_node_recursive(current_item, inherited_state=None):
            validated = _validate_deploy_card(current_item, inherited_state)
            if validated['liberado'] == 'excluded':
                return None
            
            child_ids = children_of.get(current_item['id'], [])
            children = []
            for child_id in child_ids:
                if child_id in by_id:
                    child_node = build_node_recursive(by_id[child_id], validated['effectiveState'])
                    if child_node:
                        children.append(child_node)
            
            child_issues = []
            for ch in children:
                if ch['liberado'] == 'no':
                    child_issues.append(f'Filho #{ch["id"]} ({ch["type"]}): {"; ".join(ch["issues"])}')
            
            all_issues = validated['issues'] + child_issues
            liberado = validated['liberado']
            if liberado == 'yes' and child_issues:
                liberado = 'no'
            if liberado == 'pending' and child_issues and validated['testeOk']:
                liberado = 'no'
            
            node = {
                **validated,
                'issues': all_issues,
                'liberado': liberado,
                'children': children
            }
            del node['_relations']
            return node
        
        return build_node_recursive(item, None)
    
    child_id_set = set()
    for ids in children_of.values():
        child_id_set.update(ids)
    
    roots = []
    for item in mapped:
        if _is_deploy_parent_type(item['type']):
            node = build_validated_node(item)
            if node:
                roots.append(node)
        elif _is_deploy_child_type(item['type']) and item['id'] not in child_id_set and item['id'] not in parent_of:
            node = build_validated_node(item)
            if node:
                roots.append(node)
        elif _is_deploy_child_type(item['type']) and item['id'] in parent_of and parent_of[item['id']] not in by_id:
            node = build_validated_node(item)
            if node:
                roots.append(node)
    
    roots.sort(key=lambda a: ((a.get('area', '') or ''), a['id']))
    
    liberados = 0
    problemas = 0
    pendentes = 0
    
    def count_node(node):
        nonlocal liberados, problemas, pendentes
        if node['liberado'] == 'yes':
            liberados += 1
        elif node['liberado'] == 'no':
            problemas += 1
        else:
            pendentes += 1
        for child in node.get('children', []):
            count_node(child)
    
    for root in roots:
        count_node(root)
    
    return {
        'iterationPath': iteration_path,
        'items': roots,
        'summary': {
            'total': liberados + problemas + pendentes,
            'liberados': liberados,
            'problemas': problemas,
            'pendentes': pendentes
        }
    }


def _read_azure_error_detail(response):
    """Extrai detalhes de erro da resposta Azure."""
    try:
        err = response.json()
        return err.get('message') or err.get('value', {}).get('Message') or err.get('value', {}).get('message') or response.reason or f'HTTP {response.status_code}'
    except Exception:
        return response.reason or f'HTTP {response.status_code}'


def _is_deploy_relevant_type(work_type):
    """Verifica se tipo de work item e relevante para validacao de deploy."""
    normalized = _normalize_work_item_type(work_type)
    return normalized in ['PBI', 'Product Backlog Item', 'Bug', 'Task', 'Fix', 'Ocorrencia']


def _is_excluded_deploy_type(work_type):
    """Verifica se tipo de work item deve ser excluido da validacao."""
    return False


def _is_deploy_parent_type(work_type):
    """Verifica se tipo pode ser parent em arvore de deploy."""
    normalized = _normalize_work_item_type(work_type)
    return normalized in ['PBI', 'Product Backlog Item', 'Bug']


def _is_deploy_child_type(work_type):
    """Verifica se tipo pode ser child em arvore de deploy."""
    normalized = _normalize_work_item_type(work_type)
    return normalized in ['Task', 'Fix', 'Ocorrencia']


def _is_hierarchy_child_rel(rel):
    """Verifica se relacao e do tipo hierarchy-forward."""
    return rel.get('rel') == 'System.LinkTypes.Hierarchy-forward'


def _is_hierarchy_parent_rel(rel):
    """Verifica se relacao e do tipo hierarchy-reverse."""
    return rel.get('rel') == 'System.LinkTypes.Hierarchy-reverse'


def _relation_id(rel):
    """Extrai ID de uma relacao."""
    if not rel.get('url'):
        return None
    match = re.search(r'/(\d+)$', rel['url'])
    return int(match.group(1)) if match else None


def _validate_deploy_card(item, inherited_state=None):
    """Valida card de deploy retornando issues e status."""
    issues = []
    state = item.get('state', '')
    effective_state = inherited_state if inherited_state and _is_deploy_child_type(item['type']) else state
    normalized_state = _normalize_text(effective_state)
    teste_ok = normalized_state == 'teste ok'
    
    tags = [t.strip() for t in (item.get('tags') or '').split(';') if t.strip()]
    normalized_tags = [_normalize_text(tag) for tag in tags]
    stack_tags = _extract_deploy_stack_tags(tags)
    has_stack_tag = len(stack_tags) > 0
    has_deploy_tag = any('liberado deploy' in tag for tag in normalized_tags)
    qa_responsibles = _extract_qa_responsibles(tags)
    is_occurrence_closed = _is_occurrence_type(item['type']) and normalized_state in ['done', 'closed']
    
    liberado = 'yes'
    
    if not has_stack_tag:
        issues.append('Faltam tags de stack: Front, Backend ou Front e Back')
        liberado = 'no'
    
    if not has_deploy_tag:
        issues.append('Falta tag "Liberado deploy"')
        liberado = 'no'
    
    if is_occurrence_closed:
        liberado = 'excluded'
    
    return {
        'id': item['id'],
        'title': item.get('title', ''),
        'type': item['type'],
        'state': state,
        'effectiveState': effective_state,
        'stateDisplay': _get_state_display(state),
        'effectiveStateDisplay': _get_state_display(effective_state),
        'area': _get_area_label(item.get('areaPath', '')),
        'testeOk': teste_ok,
        'liberado': liberado,
        'issues': issues,
        'tags': tags,
        'stackTags': stack_tags,
        'hasStackTag': has_stack_tag,
        'hasDeployTag': has_deploy_tag,
        'qaResponsibles': qa_responsibles,
        'deployTag': 'Liberado deploy' if has_deploy_tag else '',
        'isOccurrenceClosed': is_occurrence_closed,
        '_relations': item.get('_relations', [])
    }


def _get_state_display(state):
    """Formata state com emoji para exibicao."""
    state_map = {
        'Teste OK': '✅ Teste OK',
        'Teste': '🔄 Em Teste',
        'Em Desenvolvimento': '🔨 Em Desenvolvimento',
        'Pronto': '📋 Pronto',
        'Fechado': '🔒 Fechado',
        'Ativo': '🔵 Ativo'
    }
    return state_map.get(state, state or '❓ Sem estado')


def _get_area_label(area_path):
    """Extrai ultimo segmento do area path."""
    if not area_path:
        return 'Sem area'
    parts = [p for p in str(area_path).split('\\') if p]
    return parts[-1] if parts else area_path


def _normalize_work_item_type(work_type):
    """Normaliza nome de Work Item Type."""
    normalized = _normalize_text(work_type)
    if normalized == 'product backlog item':
        return 'Product Backlog Item'
    if normalized == 'pbi':
        return 'PBI'
    if normalized == 'task':
        return 'Task'
    if normalized == 'bug':
        return 'Bug'
    if normalized == 'fix':
        return 'Fix'
    if 'ocorr' in normalized:
        return 'Ocorrencia'
    return work_type or ''


def _normalize_text(value):
    """Normaliza texto para comparacao case-insensitive sem acentos."""
    import unicodedata
    text = str(value or '').strip()
    text = unicodedata.normalize('NFD', text)
    text = ''.join(c for c in text if unicodedata.category(c) != 'Mn')
    return text.lower()


def _extract_deploy_stack_tags(tags):
    """Extrai tags de stack (Front, Back, Tecnica) das tags."""
    stack = set()
    for tag in (tags or []):
        norm = _normalize_text(tag)
        if 'front' in norm:
            stack.add('Front')
        if 'back' in norm or 'bck' in norm:
            stack.add('Back')
        if 'tecnica' in norm:
            stack.add('Tecnica')
    return sorted(list(stack))


def _extract_qa_responsibles(tags):
    """Extrai nomes de responsaveis QA das tags."""
    aliases = [
        {'name': 'Kaua', 'match': ['kaua']},
        {'name': 'Isabelle', 'match': ['isabelle', 'isa']},
        {'name': 'Nicoly', 'match': ['nicoly', 'nic']},
        {'name': 'Camila', 'match': ['camila']},
        {'name': 'Aline', 'match': ['aline']},
        {'name': 'Bruno', 'match': ['bruno', 'brunao']}
    ]
    
    normalized_tags = [_normalize_text(tag) for tag in (tags or [])]
    responsibles = []
    
    for alias in aliases:
        hit = any(
            any(_normalize_text(m) in tag for m in alias['match'])
            for tag in normalized_tags
        )
        if hit:
            responsibles.append(alias['name'])
    
    return sorted(list(set(responsibles)))


def _is_occurrence_type(work_type):
    """Verifica se tipo e Ocorrencia."""
    return _normalize_work_item_type(work_type) == 'Ocorrencia'


def _azure_fetch_work_items_by_ids(access_token, org_url, project, ids):
    """Fetch multiplos work items por IDs."""
    if not ids:
        return []
    
    headers = {'Authorization': f'Bearer {access_token}', 'Accept': 'application/json'}
    ids_str = ','.join(map(str, ids))
    url = f'{org_url}/{project}/_apis/wit/workitems?ids={ids_str}&$expand=relations&api-version=7.1'
    
    response = requests.get(url, headers=headers, timeout=60)
    
    if not response.ok:
        raise RuntimeError(f'Falha ao buscar work items: {response.status_code}')
    
    return response.json().get('value', [])


def _map_work_item_raw(wi, org_url, project):
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
