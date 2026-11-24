import base64

import pytest

from src.boards.domain import bug_payload as bp


def b64(data: bytes) -> str:
    return base64.b64encode(data).decode()


def test_severity_value_mapeia_chaves_e_ignora_invalidas():
    assert bp.severity_value('critical') == '1 - Critical'
    assert bp.severity_value(' HIGH ') == '2 - High'
    assert bp.severity_value('low') == '4 - Low'
    assert bp.severity_value('banana') is None
    assert bp.severity_value(None) is None


def test_sanitize_file_name_remove_diretorios_e_caracteres_perigosos():
    assert bp.sanitize_file_name('../../etc/passwd') == 'passwd'
    assert bp.sanitize_file_name('C:\\temp\\a.png') == 'a.png'
    assert bp.sanitize_file_name('a<b>:c|d?.png') == 'a_b__c_d_.png'
    assert bp.sanitize_file_name('') == 'anexo'
    assert bp.sanitize_file_name('...') == 'anexo'
    assert len(bp.sanitize_file_name('x' * 500)) == 120


def test_decode_attachments_valido_e_vazio():
    out = bp.decode_attachments([{'fileName': 'a.png', 'base64Content': b64(b'abc')}])
    assert out == [{'fileName': 'a.png', 'content': b'abc'}]
    assert bp.decode_attachments(None) == []
    assert bp.decode_attachments([]) == []


@pytest.mark.parametrize('items, message', [
    ('texto', 'lista'),
    (['x'], 'invalido'),
    ([{'fileName': 'a.png'}], 'sem conteudo'),
    ([{'fileName': 'a.png', 'base64Content': '***nao-base64***'}], 'base64'),
])
def test_decode_attachments_rejeita_entradas_invalidas(items, message):
    with pytest.raises(ValueError, match=message):
        bp.decode_attachments(items)


def test_decode_attachments_limites(monkeypatch):
    many = [{'fileName': f'{i}.png', 'base64Content': b64(b'x')} for i in range(bp.MAX_ATTACHMENTS + 1)]
    with pytest.raises(ValueError, match='No maximo'):
        bp.decode_attachments(many)

    monkeypatch.setattr(bp, 'MAX_ATTACHMENT_BYTES', 4)
    with pytest.raises(ValueError, match='excede'):
        bp.decode_attachments([{'fileName': 'a', 'base64Content': b64(b'12345')}])

    monkeypatch.setattr(bp, 'MAX_ATTACHMENT_BYTES', 100)
    monkeypatch.setattr(bp, 'MAX_TOTAL_BYTES', 5)
    two = [{'fileName': 'a', 'base64Content': b64(b'123')}, {'fileName': 'b', 'base64Content': b64(b'456')}]
    with pytest.raises(ValueError, match='somam'):
        bp.decode_attachments(two)


def test_build_bug_ops_completo_e_minimo():
    ops = bp.build_bug_ops('T', '<p>x</p>', 'https://dev.azure.com/o', 'P', 55, '2 - High',
                           [{'url': 'https://a/1', 'comment': 'a.png'}])
    paths = [o['path'] for o in ops]
    assert paths[:4] == ['/fields/System.Title', '/fields/System.WorkItemType',
                         '/fields/Microsoft.VSTS.TCM.ReproSteps', '/fields/Microsoft.VSTS.Common.Severity']
    assert ops[3]['value'] == '2 - High'
    rel = [o['value'] for o in ops if o['path'] == '/relations/-']
    assert rel[0]['rel'] == 'Microsoft.VSTS.Common.TestedBy-Reverse'
    assert rel[0]['url'].endswith('/P/_apis/wit/workItems/55')
    assert rel[1] == {'rel': 'AttachedFile', 'url': 'https://a/1', 'attributes': {'comment': 'a.png'}}

    minimal = bp.build_bug_ops('T', None, 'o', 'p')
    assert len(minimal) == 3
    assert minimal[2]['value'] == ''


def test_without_severity_e_deteccao_de_erro():
    ops = bp.build_bug_ops('T', 'c', 'o', 'p', severity='1 - Critical')
    assert all('Severity' not in o['path'] for o in bp.without_severity(ops))
    assert len(bp.without_severity(ops)) == len(ops) - 1
    assert bp.mentions_severity_error('Field Microsoft.VSTS.Common.Severity does not exist')
    assert not bp.mentions_severity_error('outro erro')
    assert not bp.mentions_severity_error(None)
