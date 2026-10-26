"""
Integracao com o GitHub Copilot via GitHub Copilot CLI (`copilot`, pacote npm @github/copilot).

O backend executa o CLI em modo nao interativo (prompt por stdin, saida em texto) e devolve a resposta
do modelo. O token GitHub da sessao OAuth do usuario e repassado ao processo filho apenas pela variavel
de ambiente COPILOT_GITHUB_TOKEN: nunca vai para argumentos de linha de comando, logs ou disco. O CLI roda
em um diretorio temporario vazio, com um COPILOT_HOME proprio, sem MCPs nem ferramentas, para que seja
usado apenas como "motor de texto" e nao leia nem altere arquivos do projeto.

Requisito: `npm install -g @github/copilot` (ou COPILOT_CLI_PATH apontando para o executavel).
"""
import os
import shutil
import subprocess
import tempfile
import threading
import time

from ....shared.clock import now_iso
from .copilot import (
    CopilotAuthError,
    _acquire_copilot_slot,
    _get_fallback_github_token,
    _get_int_env,
    _normalize_model_name,
    _release_copilot_slot,
    get_copilot_status,
)

_AUTH_MARKERS = (
    "not authenticated",
    "not logged in",
    "authentication",
    "unauthorized",
    "401",
    "403",
    "no access",
    "subscription",
    "copilot is not enabled",
)

_work_dirs = {}
_work_dirs_lock = threading.Lock()


def _resolve_cli_path():
    configured = (os.environ.get("COPILOT_CLI_PATH") or "").strip()
    path = configured if configured and os.path.exists(configured) else shutil.which(configured or "copilot")
    if not path:
        raise RuntimeError(
            "COPILOT_CLI_NOT_FOUND: GitHub Copilot CLI nao encontrado. Instale com "
            "`npm install -g @github/copilot` ou defina COPILOT_CLI_PATH."
        )
    return path


def _get_work_dir(name):
    with _work_dirs_lock:
        path = _work_dirs.get(name)
        if not path or not os.path.isdir(path):
            path = tempfile.mkdtemp(prefix=f"qualiflow-copilot-{name}-")
            _work_dirs[name] = path
        return path


def get_cli_model_candidates(preferred_model=None):
    """Modelos a tentar, em ordem. `None` = modelo padrao do CLI (sempre o ultimo recurso)."""
    ordered = [
        _normalize_model_name(preferred_model or ""),
        _normalize_model_name(os.environ.get("COPILOT_MODEL", "")),
        *[_normalize_model_name(v) for v in (os.environ.get("COPILOT_MODEL_FALLBACKS", "") or "").split(",")],
    ]
    result = []
    for model in ordered:
        if model and model not in result:
            result.append(model)
    result.append(None)
    return result


def _build_env(github_token):
    env = {k: v for k, v in os.environ.items() if k not in ("GH_TOKEN", "GITHUB_TOKEN", "COPILOT_GITHUB_TOKEN")}
    env["COPILOT_GITHUB_TOKEN"] = github_token
    env["COPILOT_HOME"] = _get_work_dir("home")
    env["NO_COLOR"] = "1"
    return env


def _redact(text, token):
    return (text or "").replace(token, "<token>") if token else (text or "")


def _run_cli(cli_path, prompt, model, github_token, timeout_s):
    command = [
        cli_path,
        "-s",
        "--no-ask-user",
        "--no-auto-update",
        "--no-custom-instructions",
        "--disable-builtin-mcps",
        "--available-tools",
        "none",
    ]
    if model:
        command += ["--model", model]

    try:
        completed = subprocess.run(
            command,
            input=prompt,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout_s,
            cwd=_get_work_dir("cwd"),
            env=_build_env(github_token),
        )
    except subprocess.TimeoutExpired:
        raise RuntimeError("COPILOT_TIMEOUT: tempo limite excedido na execucao do Copilot CLI.")

    stdout = (completed.stdout or "").strip()
    stderr = _redact((completed.stderr or "").strip(), github_token)
    if completed.returncode != 0 or not stdout:
        detail = _redact(stdout or stderr, github_token)[:300]
        if any(marker in detail.lower() for marker in _AUTH_MARKERS):
            raise CopilotAuthError(f"acesso negado pelo Copilot CLI: {detail}")
        raise RuntimeError(f"Copilot CLI falhou (codigo {completed.returncode}): {detail or 'sem saida'}")
    return stdout


def send_prompt_to_copilot_cli(prompt, github_token=None, preferred_model=None):
    token = (github_token or _get_fallback_github_token() or "").strip()
    if not token:
        raise RuntimeError("COPILOT_AUTH_MISSING_TOKEN")
    cli_path = _resolve_cli_path()

    _acquire_copilot_slot()
    try:
        per_model_timeout_ms = _get_int_env("COPILOT_PER_MODEL_TIMEOUT_MS", 90000)
        total_timeout_ms = _get_int_env("COPILOT_TOTAL_TIMEOUT_MS", 240000)
        started_at = time.time() * 1000
        last_error = None

        for model in get_cli_model_candidates(preferred_model):
            elapsed_ms = time.time() * 1000 - started_at
            if elapsed_ms >= total_timeout_ms:
                raise RuntimeError("COPILOT_TOTAL_TIMEOUT")
            timeout_s = min(per_model_timeout_ms, max(5000, total_timeout_ms - elapsed_ms)) / 1000

            try:
                print(f"[{now_iso()}] [copilot-cli] Tentando modelo: {model or 'padrao do CLI'}")
                content = _run_cli(cli_path, prompt, model, token, timeout_s)
                print(f"[{now_iso()}] [copilot-cli] Resposta recebida (modelo: {model or 'padrao do CLI'})")
                return content
            except CopilotAuthError:
                raise
            except Exception as error:
                last_error = error
                print(f"[{now_iso()}] [copilot-cli] Falha no modelo {model or 'padrao do CLI'}: {error}")

        raise last_error or RuntimeError("Nenhum modelo disponivel respondeu com sucesso.")
    finally:
        _release_copilot_slot()


def get_copilot_cli_status():
    status = get_copilot_status()
    try:
        _resolve_cli_path()
        cli_available = True
    except RuntimeError:
        cli_available = False
    return {**status, "mode": "copilot-cli", "cliAvailable": cli_available}


class CopilotCliGateway:
    """Implementa a porta CopilotGateway (application/ports.py) executando o GitHub Copilot CLI."""

    def send_prompt(self, prompt, github_token=None, preferred_model=None):
        return send_prompt_to_copilot_cli(prompt, github_token=github_token, preferred_model=preferred_model)

    def get_model_candidates(self, preferred_model=None):
        return [m for m in get_cli_model_candidates(preferred_model) if m]

    def get_status(self):
        return get_copilot_cli_status()
