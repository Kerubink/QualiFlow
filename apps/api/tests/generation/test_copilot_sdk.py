import pytest

from src.generation.domain.errors import classify_copilot_error
from src.generation.infrastructure.providers import copilot_sdk
from src.generation.infrastructure.providers.copilot import CopilotAuthError


@pytest.fixture(autouse=True)
def _env(monkeypatch):
    monkeypatch.delenv("COPILOT_MODEL", raising=False)
    monkeypatch.delenv("COPILOT_MODEL_FALLBACKS", raising=False)
    for name in ("COPILOT_GITHUB_TOKEN", "GH_TOKEN", "GITHUB_TOKEN"):
        monkeypatch.delenv(name, raising=False)


def _patch_ask(monkeypatch, handler):
    async def fake_ask(github_token, prompt, model, timeout_s):
        return handler(github_token, prompt, model)

    monkeypatch.setattr(copilot_sdk, "_ask", fake_ask)


def test_candidates_end_with_default(monkeypatch):
    monkeypatch.setenv("COPILOT_MODEL", "gpt-5-mini")
    assert copilot_sdk.get_sdk_model_candidates("claude-sonnet-4.5") == ["claude-sonnet-4.5", "gpt-5-mini", None]


def test_prompt_and_token_reach_sdk(monkeypatch):
    seen = {}

    def handler(token, prompt, model):
        seen.update(token=token, prompt=prompt, model=model)
        return '{"ok": true}'

    _patch_ask(monkeypatch, handler)
    assert copilot_sdk.send_prompt_to_copilot_sdk("meu prompt", github_token="gho_x") == '{"ok": true}'
    assert seen == {"token": "gho_x", "prompt": "meu prompt", "model": None}


def test_unavailable_model_falls_back_to_next(monkeypatch):
    calls = []

    def handler(token, prompt, model):
        calls.append(model)
        if model:
            raise RuntimeError(f"Model {model} is not available")
        return "resposta"

    _patch_ask(monkeypatch, handler)
    assert copilot_sdk.send_prompt_to_copilot_sdk("p", github_token="gho_t", preferred_model="x") == "resposta"
    assert calls == ["x", None]


def test_auth_failure_stops_fallbacks_and_redacts_token(monkeypatch):
    calls = []

    def handler(token, prompt, model):
        calls.append(model)
        raise RuntimeError("No GitHub OAuth token provided: gho_segredo")

    _patch_ask(monkeypatch, handler)
    with pytest.raises(CopilotAuthError) as exc:
        copilot_sdk.send_prompt_to_copilot_sdk("p", github_token="gho_segredo", preferred_model="m")
    assert "gho_segredo" not in str(exc.value)
    assert len(calls) == 1
    assert classify_copilot_error(exc.value)["code"] == "COPILOT_AUTH_ERROR"


def test_timeout_is_classified(monkeypatch):
    def handler(token, prompt, model):
        raise TimeoutError()

    _patch_ask(monkeypatch, handler)
    with pytest.raises(RuntimeError) as exc:
        copilot_sdk.send_prompt_to_copilot_sdk("p", github_token="gho_t")
    assert classify_copilot_error(exc.value)["code"] == "COPILOT_TIMEOUT"


def test_empty_response_is_error(monkeypatch):
    _patch_ask(monkeypatch, lambda *a: "")
    with pytest.raises(RuntimeError, match="vazia"):
        copilot_sdk.send_prompt_to_copilot_sdk("p", github_token="gho_t")


def test_sdk_not_installed_is_classified(monkeypatch):
    async def fake_ask(*args):
        raise ImportError("copilot")

    monkeypatch.setattr(copilot_sdk, "_ask", fake_ask)
    with pytest.raises(RuntimeError) as exc:
        copilot_sdk.send_prompt_to_copilot_sdk("p", github_token="gho_t")
    assert classify_copilot_error(exc.value)["code"] == "COPILOT_SDK_NOT_INSTALLED"


def test_missing_token():
    with pytest.raises(RuntimeError, match="COPILOT_AUTH_MISSING_TOKEN"):
        copilot_sdk.send_prompt_to_copilot_sdk("p")
