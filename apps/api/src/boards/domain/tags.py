"""Tags de um Test Case: as escolhidas no cenario tem prioridade; sem escolha, herda as do card pai."""


def normalize_tags(value):
    """Aceita lista ou string 'a; b' e devolve a string no formato do Azure (System.Tags), sem duplicatas."""
    if isinstance(value, str):
        value = value.split(';')
    seen = []
    for raw in value or []:
        tag = str(raw).strip()
        if tag and tag.lower() not in [t.lower() for t in seen]:
            seen.append(tag)
    return '; '.join(seen)


def resolve_tags(item, parent_data=None):
    """Retorna a string de tags a gravar, ou None quando nao ha nada a gravar.

    Se o cenario traz o campo 'tags' (mesmo vazio), ele manda: vazio significa "sem tags".
    """
    if item and item.get('tags') is not None:
        return normalize_tags(item['tags'])
    parent_tags = (parent_data or {}).get('tags') or ''
    return parent_tags or None
