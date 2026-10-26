"""Execucao de testes no Azure DevOps: Test Points, Test Runs, resultados e anexos.
"""
import requests

from .http import read_headers, write_headers


def get_test_points_for_test_cases(access_token, org_url, project, test_case_ids):
    """Resolve Test Points para Test Cases em Plans/Suites."""
    headers = read_headers(access_token)

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


def add_adhoc_test_results(access_token, org_url, project, run_id, test_case_ids):
    """Adiciona resultados Ad-Hoc de testes a um Test Run."""
    headers = write_headers(access_token, 'application/json')

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


def create_test_run(access_token, org_url, project, title, plan_id=None, point_ids=None):
    """Cria um novo Test Run."""
    headers = write_headers(access_token, 'application/json')

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


def get_run_results(access_token, org_url, project, run_id):
    """Busca resultados de um Test Run."""
    headers = read_headers(access_token)

    url = f'{org_url}/{project}/_apis/test/runs/{run_id}/results?api-version=7.1'
    resp = requests.get(url, headers=headers, timeout=30)
    if not resp.ok:
        raise RuntimeError(f'Falha ao buscar resultados do Run: {resp.status_code}')

    data = resp.json()
    return data.get('value', [])


def update_test_result(access_token, org_url, project, run_id, result_id, outcome, comment=None, step_results=None):
    """Atualiza resultado de um teste em um Test Run."""
    headers = write_headers(access_token, 'application/json')

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


def complete_test_run(access_token, org_url, project, run_id, state):
    """Marca um Test Run como concluido."""
    headers = write_headers(access_token, 'application/json')

    url = f'{org_url}/{project}/_apis/test/runs/{run_id}?api-version=7.1'
    resp = requests.patch(url, headers=headers, json={'state': state}, timeout=30)
    if not resp.ok:
        raise RuntimeError(f'Falha ao concluir run: {resp.status_code}')

    return True


def add_attachment(access_token, org_url, project, run_id, result_id, file_name, base64_content, comment=None):
    """Adiciona um anexo a um resultado de teste."""
    headers = write_headers(access_token, 'application/json')

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
