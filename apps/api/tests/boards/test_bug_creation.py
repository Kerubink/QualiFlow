import base64

import pytest
from flask import Flask

from src.boards.infrastructure.azure import work_items


class FakeResponse:
    def __init__(self, ok=True, status_code=200, payload=None, text=''):
        self.ok = ok
        self.status_code = status_code
        self._payload = payload or {}
        self.text = text

    def json(self):
        return self._payload


def b64(data):
    return base64.b64encode(data).decode()


@pytest.fixture
def calls(monkeypatch):
    log = []

    def fake_post(url, headers=None, json=None, data=None, timeout=None):
        log.append({'url': url, 'headers': headers, 'json': json, 'data': data})
        if '/_apis/wit/attachments' in url:
            return FakeResponse(payload={'url': f'https://att/{len(log)}'})
        return FakeResponse(payload={'id': 321})

    monkeypatch.setattr(work_items.requests, 'post', fake_post)
    return log


def test_bug_sem_extras_mantem_comportamento_anterior(calls):
    result = work_items.create_bug_from_failure('tok', 'https://o', 'P', 'Titulo', '<p>c</p>', 1, 77)
    assert result == {'id': 321, 'attachmentErrors': []}
    assert len(calls) == 1
    ops = calls[0]['json']
    assert [o['path'] for o in ops] == ['/fields/System.Title', '/fields/System.WorkItemType',
                                        '/fields/Microsoft.VSTS.TCM.ReproSteps', '/relations/-']


def test_bug_com_severidade_e_anexos(calls):
    result = work_items.create_bug_from_failure(
        'tok', 'https://o', 'P', 'T', 'c', None, 77, 'high',
        [{'fileName': '../a b.png', 'base64Content': b64(b'png-bytes')}],
    )
    assert result['id'] == 321 and result['attachmentErrors'] == []
    upload, create = calls
    assert upload['url'].startswith('https://o/P/_apis/wit/attachments?fileName=a%20b.png')
    assert upload['data'] == b'png-bytes'
    assert upload['headers']['Content-Type'] == 'application/octet-stream'
    paths = [o['path'] for o in create['json']]
    assert '/fields/Microsoft.VSTS.Common.Severity' in paths
    attached = [o['value'] for o in create['json'] if o['value'] and isinstance(o['value'], dict) and o['value'].get('rel') == 'AttachedFile']
    assert attached and attached[0]['url'] == 'https://att/1'


def test_falha_em_anexo_nao_impede_o_bug(monkeypatch):
    def fake_post(url, headers=None, json=None, data=None, timeout=None):
        if '/_apis/wit/attachments' in url:
            return FakeResponse(ok=False, status_code=500)
        return FakeResponse(payload={'id': 9})

    monkeypatch.setattr(work_items.requests, 'post', fake_post)
    result = work_items.create_bug_from_failure('t', 'o', 'p', 'T', 'c', attachments=[{'fileName': 'a.png', 'base64Content': b64(b'x')}])
    assert result['id'] == 9
    assert result['attachmentErrors'] == ['a.png: HTTP 500']


def test_processo_sem_campo_de_severidade_tenta_de_novo_sem_ela(monkeypatch):
    seen = []

    def fake_post(url, headers=None, json=None, data=None, timeout=None):
        seen.append(json)
        has_sev = any('Severity' in o['path'] for o in json)
        if has_sev:
            return FakeResponse(ok=False, status_code=400, text='Field Microsoft.VSTS.Common.Severity does not exist')
        return FakeResponse(payload={'id': 5})

    monkeypatch.setattr(work_items.requests, 'post', fake_post)
    result = work_items.create_bug_from_failure('t', 'o', 'p', 'T', 'c', severity='critical')
    assert result['id'] == 5
    assert len(seen) == 2


def test_erro_diferente_de_severidade_nao_faz_retry(monkeypatch):
    count = []

    def fake_post(url, headers=None, json=None, data=None, timeout=None):
        count.append(1)
        return FakeResponse(ok=False, status_code=400, text='titulo invalido')

    monkeypatch.setattr(work_items.requests, 'post', fake_post)
    with pytest.raises(RuntimeError, match='Falha ao criar bug'):
        work_items.create_bug_from_failure('t', 'o', 'p', 'T', 'c', severity='critical')
    assert len(count) == 1


def test_anexo_invalido_levanta_valueerror_antes_de_chamar_o_azure(monkeypatch):
    monkeypatch.setattr(work_items.requests, 'post', lambda *a, **k: pytest.fail('nao deveria chamar o Azure'))
    with pytest.raises(ValueError):
        work_items.create_bug_from_failure('t', 'o', 'p', 'T', 'c', attachments=[{'fileName': 'a', 'base64Content': '!!'}])


def test_rota_devolve_400_para_anexo_invalido_e_200_com_attachment_errors(monkeypatch):
    from src.boards.interface import azure_routes

    app = Flask(__name__)
    app.register_blueprint(azure_routes.azure_routes)
    monkeypatch.setattr(azure_routes, 'require_board_session', lambda provider: ({'accessToken': 'x'}, None))

    class Svc:
        def create_bug(self, *args, **kwargs):
            if args[-1] == 'ruim':
                raise ValueError('Anexo invalido.')
            return {'id': 12, 'attachmentErrors': ['a.png: HTTP 500']}

    monkeypatch.setattr(azure_routes, 'azure_service', Svc())
    client = app.test_client()

    ok = client.post('/api/board/azure/bug', json={'title': 't', 'attachments': []})
    assert ok.status_code == 200
    assert ok.get_json() == {'success': True, 'bugId': 12, 'attachmentErrors': ['a.png: HTTP 500']}

    bad = client.post('/api/board/azure/bug', json={'title': 't', 'attachments': 'ruim'})
    assert bad.status_code == 400
