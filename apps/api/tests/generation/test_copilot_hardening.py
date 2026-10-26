import pytest

from src.generation.domain.errors import classify_copilot_error
from src.generation.infrastructure.ai_gateway import ProviderAiGateway


class _FakeCopilot:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = 0

    def send_prompt(self, prompt, github_token=None, preferred_model=None):
        self.calls += 1
        return self.responses.pop(0)


def test_gateway_repete_uma_vez_quando_copilot_devolve_json_invalido():
    copilot = _FakeCopilot(["isto nao e json", '{"test_cases": []}'])
    result = ProviderAiGateway(copilot).json_prompt("copilot", {}, "p", github_token="t")
    assert result == {"test_cases": []}
    assert copilot.calls == 2


def test_gateway_propaga_erro_apos_segunda_resposta_invalida():
    copilot = _FakeCopilot(["lixo", "lixo"])
    with pytest.raises(RuntimeError, match="INVALID_JSON_RESPONSE"):
        ProviderAiGateway(copilot).json_prompt("copilot", {}, "p", github_token="t")
    assert copilot.calls == 2


def test_classifica_falha_de_token_do_copilot_como_auth():
    error = classify_copilot_error(RuntimeError("Falha ao obter token do Copilot (HTTP 404). Confirme"))
    assert error["code"] == "COPILOT_AUTH_ERROR"


def test_palavra_path_nao_e_confundida_com_pat():
    error = classify_copilot_error(RuntimeError("erro em /some/path/x"))
    assert error["code"] != "COPILOT_AUTH_UNSUPPORTED_TOKEN"
