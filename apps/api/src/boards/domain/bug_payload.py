"""Regras puras do Bug criado a partir de um passo reprovado: severidade, anexos e operacoes JSON Patch.
Sem I/O: a camada de infraestrutura faz os uploads e envia o patch montado aqui.
"""
import base64
import binascii
import os
import re

SEVERITY_FIELD = 'Microsoft.VSTS.Common.Severity'
SEVERITY_VALUES = {
    'critical': '1 - Critical',
    'high': '2 - High',
    'medium': '3 - Medium',
    'low': '4 - Low',
}

MAX_ATTACHMENTS = 10
MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024
MAX_TOTAL_BYTES = 40 * 1024 * 1024


def severity_value(key):
    """Valor do campo de severidade do Azure para a chave ('critical'...'low'); None se invalida/ausente."""
    return SEVERITY_VALUES.get(str(key or '').strip().lower())


def sanitize_file_name(name):
    """Nome de arquivo seguro: sem diretorios, sem caracteres de controle, nao vazio."""
    base = os.path.basename(str(name or '').replace('\\', '/'))
    base = re.sub(r'[\x00-\x1f<>:"|?*]', '_', base).strip(' .')
    return base[:120] or 'anexo'


def decode_attachments(items):
    """Valida e decodifica anexos [{fileName, base64Content}] -> [{fileName, content(bytes)}].

    Levanta ValueError (mensagem para o usuario) em anexo invalido ou acima dos limites.
    """
    if not items:
        return []
    if not isinstance(items, list):
        raise ValueError('attachments deve ser uma lista.')
    if len(items) > MAX_ATTACHMENTS:
        raise ValueError(f'No maximo {MAX_ATTACHMENTS} anexos por bug.')

    decoded = []
    total = 0
    for item in items:
        if not isinstance(item, dict):
            raise ValueError('Anexo invalido.')
        name = sanitize_file_name(item.get('fileName'))
        raw = item.get('base64Content')
        if not isinstance(raw, str) or not raw:
            raise ValueError(f'Anexo "{name}" sem conteudo.')
        try:
            content = base64.b64decode(raw, validate=True)
        except (binascii.Error, ValueError):
            raise ValueError(f'Anexo "{name}" nao esta em base64 valido.') from None
        if len(content) > MAX_ATTACHMENT_BYTES:
            raise ValueError(f'Anexo "{name}" excede {MAX_ATTACHMENT_BYTES // (1024 * 1024)} MB.')
        total += len(content)
        if total > MAX_TOTAL_BYTES:
            raise ValueError(f'Os anexos somam mais de {MAX_TOTAL_BYTES // (1024 * 1024)} MB.')
        decoded.append({'fileName': name, 'content': content})
    return decoded


def build_bug_ops(title, comment, org_url, project, linked_work_item_id=None, severity=None, attachment_urls=None):
    """Operacoes JSON Patch para criar o Bug (campos, severidade, vinculo com o PBI e anexos ja enviados)."""
    ops = [
        {'op': 'add', 'path': '/fields/System.Title', 'value': title},
        {'op': 'add', 'path': '/fields/System.WorkItemType', 'value': 'Bug'},
        {'op': 'add', 'path': '/fields/Microsoft.VSTS.TCM.ReproSteps', 'value': comment or ''},
    ]
    if severity:
        ops.append({'op': 'add', 'path': f'/fields/{SEVERITY_FIELD}', 'value': severity})
    if linked_work_item_id:
        ops.append({
            'op': 'add',
            'path': '/relations/-',
            'value': {
                'rel': 'Microsoft.VSTS.Common.TestedBy-Reverse',
                'url': f'{org_url}/{project}/_apis/wit/workItems/{linked_work_item_id}',
            },
        })
    for att in attachment_urls or []:
        ops.append({
            'op': 'add',
            'path': '/relations/-',
            'value': {'rel': 'AttachedFile', 'url': att['url'], 'attributes': {'comment': att.get('comment', '')}},
        })
    return ops


def without_severity(ops):
    return [op for op in ops if op.get('path') != f'/fields/{SEVERITY_FIELD}']


def mentions_severity_error(message):
    """O Azure rejeita o patch quando o processo do projeto nao tem o campo de severidade."""
    return 'severity' in str(message or '').lower()
