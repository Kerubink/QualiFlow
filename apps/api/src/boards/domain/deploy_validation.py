"""Regras da validacao de deploy por sprint (Azure DevOps): tipos de card, tags de stack/deploy,
hierarquia pai/filho e totalizacao. Puro (sem I/O): recebe work items ja mapeados.
"""
import re
import unicodedata


def is_deploy_relevant_type(work_type):
    """Verifica se tipo de work item e relevante para validacao de deploy."""
    normalized = normalize_work_item_type(work_type)
    return normalized in ['PBI', 'Product Backlog Item', 'Bug', 'Task', 'Fix', 'Ocorrencia']


def is_excluded_deploy_type(work_type):
    """Verifica se tipo de work item deve ser excluido da validacao."""
    return False


def is_deploy_parent_type(work_type):
    """Verifica se tipo pode ser parent em arvore de deploy."""
    normalized = normalize_work_item_type(work_type)
    return normalized in ['PBI', 'Product Backlog Item', 'Bug']


def is_deploy_child_type(work_type):
    """Verifica se tipo pode ser child em arvore de deploy."""
    normalized = normalize_work_item_type(work_type)
    return normalized in ['Task', 'Fix', 'Ocorrencia']


def is_hierarchy_child_rel(rel):
    """Verifica se relacao e do tipo hierarchy-forward."""
    return rel.get('rel') == 'System.LinkTypes.Hierarchy-forward'


def is_hierarchy_parent_rel(rel):
    """Verifica se relacao e do tipo hierarchy-reverse."""
    return rel.get('rel') == 'System.LinkTypes.Hierarchy-reverse'


def relation_id(rel):
    """Extrai ID de uma relacao."""
    if not rel.get('url'):
        return None
    match = re.search(r'/(\d+)$', rel['url'])
    return int(match.group(1)) if match else None


def validate_deploy_card(item, inherited_state=None):
    """Valida card de deploy retornando issues e status."""
    issues = []
    state = item.get('state', '')
    effective_state = inherited_state if inherited_state and is_deploy_child_type(item['type']) else state
    normalized_state = normalize_text(effective_state)
    teste_ok = normalized_state == 'teste ok'

    tags = [t.strip() for t in (item.get('tags') or '').split(';') if t.strip()]
    normalized_tags = [normalize_text(tag) for tag in tags]
    stack_tags = extract_deploy_stack_tags(tags)
    has_stack_tag = len(stack_tags) > 0
    has_deploy_tag = any('liberado deploy' in tag for tag in normalized_tags)
    qa_responsibles = extract_qa_responsibles(tags)
    is_occurrence_closed = is_occurrence_type(item['type']) and normalized_state in ['done', 'closed']

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
        'stateDisplay': get_state_display(state),
        'effectiveStateDisplay': get_state_display(effective_state),
        'area': get_area_label(item.get('areaPath', '')),
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


def get_state_display(state):
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


def get_area_label(area_path):
    """Extrai ultimo segmento do area path."""
    if not area_path:
        return 'Sem area'
    parts = [p for p in str(area_path).split('\\') if p]
    return parts[-1] if parts else area_path


def normalize_work_item_type(work_type):
    """Normaliza nome de Work Item Type."""
    normalized = normalize_text(work_type)
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


def normalize_text(value):
    """Normaliza texto para comparacao case-insensitive sem acentos."""
    text = str(value or '').strip()
    text = unicodedata.normalize('NFD', text)
    text = ''.join(c for c in text if unicodedata.category(c) != 'Mn')
    return text.lower()


def extract_deploy_stack_tags(tags):
    """Extrai tags de stack (Front, Back, Tecnica) das tags."""
    stack = set()
    for tag in (tags or []):
        norm = normalize_text(tag)
        if 'front' in norm:
            stack.add('Front')
        if 'back' in norm or 'bck' in norm:
            stack.add('Back')
        if 'tecnica' in norm:
            stack.add('Tecnica')
    return sorted(list(stack))


def extract_qa_responsibles(tags):
    """Extrai nomes de responsaveis QA das tags."""
    aliases = [
        {'name': 'Kaua', 'match': ['kaua']},
        {'name': 'Isabelle', 'match': ['isabelle', 'isa']},
        {'name': 'Nicoly', 'match': ['nicoly', 'nic']},
        {'name': 'Camila', 'match': ['camila']},
        {'name': 'Aline', 'match': ['aline']},
        {'name': 'Bruno', 'match': ['bruno', 'brunao']}
    ]

    normalized_tags = [normalize_text(tag) for tag in (tags or [])]
    responsibles = []

    for alias in aliases:
        hit = any(
            any(normalize_text(m) in tag for m in alias['match'])
            for tag in normalized_tags
        )
        if hit:
            responsibles.append(alias['name'])

    return sorted(list(set(responsibles)))


def is_occurrence_type(work_type):
    """Verifica se tipo e Ocorrencia."""
    return normalize_work_item_type(work_type) == 'Ocorrencia'


def build_deploy_report(iteration_path, mapped):
    """Monta a arvore pai/filho de cards da sprint, valida cada card e totaliza liberados/problemas/pendentes.

    `mapped` sao os work items ja mapeados por infrastructure.azure.work_items.map_work_item_raw.
    """
    by_id = {m['id']: m for m in mapped}
    children_of = {}
    parent_of = {}

    for item in mapped:
        for rel in item.get('_relations', []):
            if is_hierarchy_child_rel(rel):
                child_id = relation_id(rel)
                if not child_id or child_id not in by_id:
                    continue
                child = by_id[child_id]
                if not is_deploy_child_type(child['type']):
                    continue
                if item['id'] not in children_of:
                    children_of[item['id']] = []
                if child_id not in children_of[item['id']]:
                    children_of[item['id']].append(child_id)
                parent_of[child_id] = item['id']

            if is_hierarchy_parent_rel(rel):
                parent_id = relation_id(rel)
                if parent_id:
                    parent_of[item['id']] = parent_id

    for item in mapped:
        if not is_deploy_child_type(item['type']):
            continue
        parent_id = parent_of.get(item['id'])
        if parent_id and parent_id in by_id and is_deploy_parent_type(by_id[parent_id]['type']):
            if parent_id not in children_of:
                children_of[parent_id] = []
            if item['id'] not in children_of[parent_id]:
                children_of[parent_id].append(item['id'])

    def build_validated_node(item):
        def build_node_recursive(current_item, inherited_state=None):
            validated = validate_deploy_card(current_item, inherited_state)
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
        if is_deploy_parent_type(item['type']):
            node = build_validated_node(item)
            if node:
                roots.append(node)
        elif is_deploy_child_type(item['type']) and item['id'] not in child_id_set and item['id'] not in parent_of:
            node = build_validated_node(item)
            if node:
                roots.append(node)
        elif is_deploy_child_type(item['type']) and item['id'] in parent_of and parent_of[item['id']] not in by_id:
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
