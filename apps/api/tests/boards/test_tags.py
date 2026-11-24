"""Tags de Test Case: prioridade do cenario sobre o card pai e listagem de tags do projeto."""
from unittest.mock import MagicMock, patch

from src.boards.domain.tags import normalize_tags, resolve_tags
from src.boards.infrastructure.azure import discovery


def test_normalize_tags_aceita_lista_e_string_sem_duplicatas():
    assert normalize_tags(["Front", " front ", "Back", ""]) == "Front; Back"
    assert normalize_tags("a;  b ;a") == "a; b"


def test_resolve_tags_cenario_tem_prioridade_e_vazio_limpa():
    assert resolve_tags({"tags": ["QA", "Regressao"]}, {"tags": "pai"}) == "QA; Regressao"
    assert resolve_tags({"tags": ""}, {"tags": "pai"}) == ""


def test_resolve_tags_herda_do_pai_sem_campo():
    assert resolve_tags({}, {"tags": "pai; x"}) == "pai; x"
    assert resolve_tags({}, {}) is None
    assert resolve_tags({}, None) is None


def test_list_tags_ordena_e_remove_duplicatas():
    response = MagicMock()
    response.ok = True
    response.json.return_value = {"value": [{"name": "zeta"}, {"name": "Alfa"}, {"name": "zeta"}, {}]}
    with patch("src.boards.infrastructure.azure.discovery.requests.get", return_value=response) as get:
        assert discovery.list_tags("tok", "https://dev.azure.com/o", "P") == ["Alfa", "zeta"]
    assert "/P/_apis/wit/tags" in get.call_args[0][0]


def test_list_tags_usa_cache_na_segunda_chamada():
    discovery._tags_cache.clear()
    response = MagicMock()
    response.ok = True
    response.json.return_value = {"value": [{"name": "a"}]}
    with patch("src.boards.infrastructure.azure.discovery.requests.get", return_value=response) as get:
        discovery.list_tags("tok", "https://dev.azure.com/o", "P")
        discovery.list_tags("tok", "https://dev.azure.com/o", "P")
    assert get.call_count == 1
