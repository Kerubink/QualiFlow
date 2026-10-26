import subprocess

import pytest

from src.generation.domain.errors import classify_copilot_error
from src.generation.infrastructure.providers import copilot_cli
from src.generation.infrastructure.providers.copilot import CopilotAuthError


@pytest.fixture(autouse=True)
def _cli_env(monkeypatch):
    monkeypatch.setattr(copilot_cli, "_resolve_cli_path", lambda: "/fake/copilot")
    monkeypatch.delenv("COPILOT_MODEL", raising=False)
    monkeypatch.delenv("COPILOT_MODEL_FALLBACKS", raising=False)


def _completed(stdout="", stderr="", code=0):
    return subprocess.CompletedProcess(args=[], returncode=code, stdout=stdout, stderr=stderr)


def test_candidates_end_with_cli_default(monkeypatch):
    monkeypatch.setenv("COPILOT_MODEL", "gpt-5-mini")
    assert copilot_cli.get_cli_model_candidates("claude-sonnet-4.5") == ["claude-sonnet-4.5", "gpt-5-mini", None]


def test_token_goes_only_through_env_and_prompt_through_stdin(monkeypatch):
    seen = {}

    def fake_run(command, **kwargs):
        seen.update(command=command, kwargs=kwargs)
        return _completed('{"ok": true}')

    monkeypatch.setattr(copilot_cli.subprocess, "run", fake_run)
    result = copilot_cli.send_prompt_to_copilot_cli("meu prompt", github_token="gho_segredo")

    assert result == '{"ok": true}'
    assert all("gho_segredo" not in part for part in seen["command"])
    assert seen["kwargs"]["input"] == "meu prompt"
    assert seen["kwargs"]["env"]["COPILOT_GITHUB_TOKEN"] == "gho_segredo"
    assert "--model" not in seen["command"]


def test_unavailable_model_falls_back_to_next(monkeypatch):
    calls = []

    def fake_run(command, **kwargs):
        model = command[command.index("--model") + 1] if "--model" in command else None
        calls.append(model)
        if model:
            return _completed(stdout='Error: Model "x" from --model flag is not available.', code=1)
        return _completed("resposta")

    monkeypatch.setattr(copilot_cli.subprocess, "run", fake_run)
    assert copilot_cli.send_prompt_to_copilot_cli("p", github_token="gho_t", preferred_model="x") == "resposta"
    assert calls == ["x", None]


def test_auth_failure_stops_fallbacks_and_redacts_token(monkeypatch):
    calls = []

    def fake_run(command, **kwargs):
        calls.append(command)
        return _completed(stderr="Not authenticated: token gho_segredo rejected", code=1)

    monkeypatch.setattr(copilot_cli.subprocess, "run", fake_run)
    with pytest.raises(CopilotAuthError) as exc:
        copilot_cli.send_prompt_to_copilot_cli("p", github_token="gho_segredo", preferred_model="m")
    assert "gho_segredo" not in str(exc.value)
    assert len(calls) == 1
    assert classify_copilot_error(exc.value)["code"] == "COPILOT_AUTH_ERROR"


def test_timeout_is_classified(monkeypatch):
    def fake_run(command, **kwargs):
        raise subprocess.TimeoutExpired(command, 1)

    monkeypatch.setattr(copilot_cli.subprocess, "run", fake_run)
    with pytest.raises(RuntimeError) as exc:
        copilot_cli.send_prompt_to_copilot_cli("p", github_token="gho_t")
    assert classify_copilot_error(exc.value)["code"] == "COPILOT_TIMEOUT"


def test_missing_cli_is_classified(monkeypatch):
    monkeypatch.undo()

    def missing():
        raise RuntimeError("COPILOT_CLI_NOT_FOUND: x")

    monkeypatch.setattr(copilot_cli, "_resolve_cli_path", missing)
    with pytest.raises(RuntimeError) as exc:
        copilot_cli.send_prompt_to_copilot_cli("p", github_token="gho_t")
    assert classify_copilot_error(exc.value)["code"] == "COPILOT_CLI_NOT_FOUND"


def test_missing_token(monkeypatch):
    monkeypatch.delenv("COPILOT_GITHUB_TOKEN", raising=False)
    monkeypatch.delenv("GH_TOKEN", raising=False)
    monkeypatch.delenv("GITHUB_TOKEN", raising=False)
    with pytest.raises(RuntimeError, match="COPILOT_AUTH_MISSING_TOKEN"):
        copilot_cli.send_prompt_to_copilot_cli("p")
