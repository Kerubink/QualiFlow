"""Iteracoes (sprints) do Azure DevOps: normalizacao de caminhos e achatamento da arvore de classification nodes.
"""
import re


def normalize_iteration_path(path, azure_project=''):
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


def flatten_iteration_nodes(node, acc=None):
    """Recursivamente flatten nodes de iteracoes."""
    if acc is None:
        acc = []

    if not node:
        return acc

    if node.get('path') or node.get('structureType') == 'iteration':
        raw_path = node.get('path', '')
        clean_path = normalize_iteration_path(raw_path)
        if clean_path and node.get('structureType') == 'iteration':
            acc.append({
                'name': node.get('name') or clean_path.split('\\')[-1],
                'path': clean_path,
                'hasChildren': bool(node.get('hasChildren') or (node.get('children') and len(node['children']) > 0))
            })

    if node.get('children') and isinstance(node['children'], list):
        for child in node['children']:
            flatten_iteration_nodes(child, acc)

    return acc


def build_iteration_options(classification_data, azure_project=''):
    """Transforma a arvore de classification nodes em opcoes de sprint (so folhas), da mais
    recente (maior numero no nome) para a mais antiga. Retorna [] se nao houver iteracoes."""
    iterations = flatten_iteration_nodes(classification_data)
    iterations = [i for i in iterations if not i.get('hasChildren', False)]

    def extract_iteration_number(name):
        match = re.search(r'\d+', name)
        return int(match.group(0)) if match else 0

    iterations.sort(key=lambda it: (-extract_iteration_number(it['name']), it['path']))

    return [{'name': it['name'], 'path': normalize_iteration_path(it['path'], azure_project)} for it in iterations]
