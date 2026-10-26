"""Auto-discovery no Azure DevOps: perfil, organizacoes, projetos e iteracoes (sprints).
"""
import requests

from ...domain.iterations import build_iteration_options
from .http import read_headers


def get_profile_id(access_token):
    """Busca o profile id (memberId) do usuario autenticado, usado para listar organizacoes."""
    headers = read_headers(access_token)
    url = 'https://app.vssps.visualstudio.com/_apis/profile/profiles/me?api-version=7.1'

    response = requests.get(url, headers=headers, timeout=15)
    if not response.ok:
        raise RuntimeError(f'Failed to fetch Azure DevOps profile: {response.status_code} {response.text}')

    return response.json().get('id')


def list_organizations(access_token):
    """Lista as organizacoes (accounts) do Azure DevOps as quais o usuario autenticado tem acesso."""
    profile_id = get_profile_id(access_token)
    if not profile_id:
        raise RuntimeError('Nao foi possivel identificar o perfil do usuario no Azure DevOps.')

    headers = read_headers(access_token)
    url = f'https://app.vssps.visualstudio.com/_apis/accounts?memberId={profile_id}&api-version=7.1'

    response = requests.get(url, headers=headers, timeout=15)
    if not response.ok:
        raise RuntimeError(f'Failed to fetch Azure DevOps organizations: {response.status_code} {response.text}')

    accounts = response.json().get('value') or []
    organizations = [
        {
            'name': account.get('accountName'),
            'url': f"https://dev.azure.com/{account.get('accountName')}",
        }
        for account in accounts
        if account.get('accountName')
    ]
    organizations.sort(key=lambda org: org['name'].lower())
    return organizations


def list_projects(access_token, org_url):
    """Lista os projetos de uma organizacao do Azure DevOps."""
    headers = read_headers(access_token)
    clean_org_url = (org_url or '').rstrip('/')
    if not clean_org_url:
        raise RuntimeError('org_url e obrigatorio para listar projetos.')

    url = f'{clean_org_url}/_apis/projects?api-version=7.1&$top=1000'

    response = requests.get(url, headers=headers, timeout=15)
    if not response.ok:
        raise RuntimeError(f'Failed to fetch Azure DevOps projects: {response.status_code} {response.text}')

    projects = response.json().get('value') or []
    result = [{'id': project.get('id'), 'name': project.get('name')} for project in projects if project.get('name')]
    result.sort(key=lambda project: project['name'].lower())
    return result


def get_project_iterations(access_token, org_url, project):
    """Busca iteracoes disponiveis do projeto."""
    headers = read_headers(access_token)

    url = f'{org_url}/{project}/_apis/wit/classificationnodes/iterations?$depth=10&api-version=7.1'
    response = requests.get(url, headers=headers, timeout=30)

    if response.ok:
        iterations = build_iteration_options(response.json(), project)
        if iterations:
            return iterations

    raise RuntimeError('Nao foi possivel carregar iteracoes. Verifique a configuracao do projeto.')
