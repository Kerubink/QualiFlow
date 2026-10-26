"""
Integracao com o GitHub Copilot via SDK oficial em Python (pacote `github-copilot-sdk`).

O SDK controla o runtime do Copilot CLI como processo filho (JSON-RPC por stdio). Nao exige Node.js, npm nem
instalacao global: o pacote vem do `pip install -r requirements.txt` e o runtime nativo e baixado (e cacheado)
na primeira execucao a partir do GitHub Releases, com verificacao de checksum.

O token GitHub da sessao OAuth do usuario e entregue ao runtime pelo proprio SDK (`github_token`), com
`use_logged_in_user=False`: nunca cai no login da maquina, nunca vai para argumentos, logs ou disco. O runtime
roda em um diretorio temporario vazio, sem ferramentas, usado apenas como "motor de texto".
"""
import asyncio
import os
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
    "no github oauth token",
    "not authenticated",
    "authentication",
    "unauthorized",
    "bad credentials",
    "401",
    "403",
    "subscription",
    "not enabled",
    "no access",
)

_work_dir = None
_work_dir_lock = threading.Lock()


def sdk_available():
    try:
        import copilot  # noqa: F401
    except ImportError:
        return False
    return True


def _get_work_dir():
    global _work_dir
    with _work_dir_lock:
        if not _work_dir or not os.path.isdir(_work_dir):
            _work_dir = tempfile.mkdtemp(prefix="qualiflow-copilot-")
        return _work_dir


def warm_up_runtime():
    """Baixa o runtime do Copilot em segundo plano (primeira execucao), para nao estourar o timeout da 1a geracao."""

    def _download():
        try:
            from copilot._cli_download import download_cli

            download_cli()
            print(f"[{now_iso()}] [copilot-sdk] Runtime do Copilot pronto.")
        except Exception as error:
            print(f"[{now_iso()}] [copilot-sdk] Nao foi possivel baixar o runtime agora: {error}")

    threading.Thread(target=_download, daemon=True, name="copilot-runtime-download").start()


def get_sdk_model_candidates(preferred_model=None):
    """Modelos a tentar, em ordem. `None` = modelo padrao do Copilot (sempre o ultimo recurso)."""
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


def _redact(text, token):
    return (text or "").replace(token, "<token>") if token else (text or "")


async def _ask(github_token, prompt, model, timeout_s):
    from copilot import CopilotClient, PermissionHandler

    work_dir = _get_work_dir()
    env = {k: v for k, v in os.environ.items() if k not in ("GH_TOKEN", "GITHUB_TOKEN", "COPILOT_GITHUB_TOKEN")}
    env["COPILOT_HOME"] = os.path.join(work_dir, "home")

    client = CopilotClient(
        github_token=github_token, use_logged_in_user=False, working_directory=work_dir, env=env
    )
    await client.start()
    try:
        options = {"on_permission_request": PermissionHandler.approve_all, "available_tools": [], "working_directory": work_dir}
        if model:
            options["model"] = model
        session = await client.create_session(**options)
        try:
            event = await session.send_and_wait(prompt, timeout=timeout_s)
        finally:
            await session.disconnect()
    finally:
        await client.stop()

    content = getattr(getattr(event, "data", None), "content", None)
    return content.strip() if isinstance(content, str) else ""


def _ask_sync(github_token, prompt, model, timeout_s):
    try:
        content = asyncio.run(_ask(github_token, prompt, model, timeout_s))
    except (TimeoutError, asyncio.TimeoutError):
        raise RuntimeError("COPILOT_TIMEOUT: tempo limite excedido na execucao do Copilot.")
    except ImportError:
        raise RuntimeError("COPILOT_SDK_NOT_INSTALLED: instale as dependencias com `pip install -r requirements.txt`.")
    except Exception as error:
        detail = _redact(str(error), github_token)[:300]
        if any(marker in detail.lower() for marker in _AUTH_MARKERS):
            raise CopilotAuthError(f"acesso negado pelo Copilot: {detail}")
        raise RuntimeError(f"Copilot falhou: {detail or type(error).__name__}")
    if not content:
        raise RuntimeError("Copilot retornou resposta vazia.")
    return content


def send_prompt_to_copilot_sdk(prompt, github_token=None, preferred_model=None):
    token = (github_token or _get_fallback_github_token() or "").strip()
    if not token:
        raise RuntimeError("COPILOT_AUTH_MISSING_TOKEN")

    _acquire_copilot_slot()
    try:
        per_model_timeout_ms = _get_int_env("COPILOT_PER_MODEL_TIMEOUT_MS", 90000)
        total_timeout_ms = _get_int_env("COPILOT_TOTAL_TIMEOUT_MS", 240000)
        started_at = time.time() * 1000
        last_error = None

        for model in get_sdk_model_candidates(preferred_model):
            elapsed_ms = time.time() * 1000 - started_at
            if elapsed_ms >= total_timeout_ms:
                raise RuntimeError("COPILOT_TOTAL_TIMEOUT")
            timeout_s = min(per_model_timeout_ms, max(5000, total_timeout_ms - elapsed_ms)) / 1000
            label = model or "padrao do Copilot"

            try:
                print(f"[{now_iso()}] [copilot-sdk] Tentando modelo: {label}")
                content = _ask_sync(token, prompt, model, timeout_s)
                print(f"[{now_iso()}] [copilot-sdk] Resposta recebida (modelo: {label})")
                return content
            except CopilotAuthError as error:
                print(f"[{now_iso()}] [copilot-sdk] Autenticacao recusada pelo Copilot: {error}")
                raise
            except RuntimeError as error:
                if str(error).startswith("COPILOT_SDK_NOT_INSTALLED"):
                    raise
                last_error = error
                print(f"[{now_iso()}] [copilot-sdk] Falha no modelo {label}: {error}")

        raise last_error or RuntimeError("Nenhum modelo disponivel respondeu com sucesso.")
    finally:
        _release_copilot_slot()


def get_copilot_sdk_status():
    return {**get_copilot_status(), "mode": "copilot-sdk", "sdkAvailable": sdk_available()}


class CopilotSdkGateway:
    """Implementa a porta CopilotGateway (application/ports.py) sobre o SDK oficial do Copilot."""

    def send_prompt(self, prompt, github_token=None, preferred_model=None):
        return send_prompt_to_copilot_sdk(prompt, github_token=github_token, preferred_model=preferred_model)

    def get_model_candidates(self, preferred_model=None):
        return [m for m in get_sdk_model_candidates(preferred_model) if m]

    def get_status(self):
        return get_copilot_sdk_status()
