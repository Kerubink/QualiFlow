"""Atlassian Document Format (ADF): conversao de/para texto. Puro (sem I/O)."""
import re


def to_adf_paragraph(text):
    """Converte texto para formato ADF (Atlassian Document Format) paragraph."""
    return {
        'type': 'paragraph',
        'content': [{'type': 'text', 'text': str(text or '')}]
    }


def adf_to_plain_text(adf_node):
    """Converte ADF node para texto plano."""
    if not adf_node:
        return ''
    if isinstance(adf_node, str):
        return adf_node

    def walk(node):
        if not node:
            return ''
        if isinstance(node, list):
            return ''.join(walk(n) for n in node)
        if node.get('type') == 'text':
            return node.get('text', '')

        content = node.get('content', [])
        if isinstance(content, list):
            content_text = ''.join(walk(c) for c in content)
        else:
            content_text = ''

        node_type = node.get('type', '')
        if node_type in ['paragraph', 'heading', 'listItem']:
            return f'{content_text}\n'
        if node_type in ['bulletList', 'orderedList', 'doc']:
            return content_text

        return content_text

    result = walk(adf_node)
    result = re.sub(r'\n{3,}', '\n\n', result)
    return result.strip()
