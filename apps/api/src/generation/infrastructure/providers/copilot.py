"""
Integracao com o GitHub Copilot via chamadas HTTP diretas (sem @github/copilot-sdk).

AVISO: api.githubcopilot.com/chat/completions e api.github.com/copilot_internal/v2/token
sao endpoints internos usados pelos editores oficiais (VS Code, Neovim, JetBrains) e NAO
sao uma API publica documentada/suportada pela GitHub. Este fluxo e o mesmo empregado por
integracoes de terceiros amplamente conhecidas na comunidade, mas pode mudar ou deixar de
funcionar sem aviso, e seu uso deve respeitar os Termos de Servico do GitHub Copilot.
"""
import os
import threading
import time

import requests

from ....shared.clock import now_iso

GITHUB_COPILOT_TOKEN_URL = "https://api.github.com/copilot_internal/v2/token"
GITHUB_COPILOT_CHAT_URL = "https://api.githubcopilot.com/chat/completions"

_EDITOR_VERSION = "vscode/1.90.0"
_EDITOR_PLUGIN_VERSION = "copilot-chat/0.22.0"
_USER_AGENT = "GithubCopilot/1.220.0"

SUPPORTED_COPILOT_MODELS = {"claude-sonnet-4.5", "claude-opus-4.5", "gpt-5-mini"}

_MODEL_ALIASES = {
    "claude-3-5-sonnet": "claude-sonnet-4.5",
    "claude-sonnet-4": "claude-sonnet-4.5",
    "claude-opus-4": "claude-opus-4.5",
    "gpt5-mini": "gpt-5-mini",
}

_copilot_token_cache = {}
_copilot_token_lock = threading.Lock()

class CopilotAuthError(RuntimeError):
    """Falha de autenticacao valida para qualquer modelo: nao adianta tentar os fallbacks."""


_copilot_slot_lock = threading.Lock()
_copilot_slot_condition = threading.Condition(_copilot_slot_lock)
_active_copilot_requests = 0


def _get_int_env(name, default_value):
    try:
        raw = int(os.environ.get(name, ""))
        return raw if raw > 0 else default_value
    except ValueError:
        return default_value


def _normalize_model_name(model):
    normalized = (model or "").strip()
    if not normalized:
        return ""
    return _MODEL_ALIASES.get(normalized, normalized)


def get_copilot_model_candidates(preferred_model=None):
    configured_model = _normalize_model_name(os.environ.get("COPILOT_MODEL", ""))
    fallback_models = [
        _normalize_model_name(value)
        for value in (os.environ.get("COPILOT_MODEL_FALLBACKS", "") or "").split(",")
        if _normalize_model_name(value)
    ]

    preferred = _normalize_model_name(preferred_model or "")

    ordered = [preferred or configured_model or "claude-sonnet-4.5", *fallback_models, "gpt-5-mini", "claude-opus-4.5"]

    seen = set()
    result = []
    for model in ordered:
        if model in SUPPORTED_COPILOT_MODELS and model not in seen:
            seen.add(model)
            result.append(model)

    return result


def _acquire_copilot_slot():
    global _active_copilot_requests
    max_concurrent = _get_int_env("COPILOT_MAX_CONCURRENT_REQUESTS", 2)
    timeout_seconds = _get_int_env("COPILOT_QUEUE_WAIT_TIMEOUT_MS", 120000) / 1000

    with _copilot_slot_condition:
        acquired = _copilot_slot_condition.wait_for(
            lambda: _active_copilot_requests < max_concurrent, timeout=timeout_seconds
        )
        if not acquired:
            raise RuntimeError("COPILOT_QUEUE_TIMEOUT")
        _active_copilot_requests += 1


def _release_copilot_slot():
    global _active_copilot_requests
    with _copilot_slot_condition:
        _active_copilot_requests = max(0, _active_copilot_requests - 1)
        _copilot_slot_condition.notify()


def _get_fallback_github_token():
    return (
        os.environ.get("COPILOT_GITHUB_TOKEN") or os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN") or ""
    ).strip()


def _exchange_github_token_for_copilot_token(github_token):
    """Troca um token OAuth do usuario (gho_/ghu_) por um token de sessao do Copilot."""
    cached = _copilot_token_cache.get(github_token)
    if cached and cached["expiresAt"] > time.time() + 30:
        return cached["token"]

    with _copilot_token_lock:
        cached = _copilot_token_cache.get(github_token)
        if cached and cached["expiresAt"] > time.time() + 30:
            return cached["token"]

        response = requests.get(
            GITHUB_COPILOT_TOKEN_URL,
            headers={
                "Authorization": f"token {github_token}",
                "Accept": "application/json",
                "User-Agent": _USER_AGENT,
                "Editor-Version": _EDITOR_VERSION,
                "Editor-Plugin-Version": _EDITOR_PLUGIN_VERSION,
            },
            timeout=15,
        )

        if response.status_code in (401, 403, 404):
            raise CopilotAuthError(
                f"Falha ao obter token do Copilot (HTTP {response.status_code}). Confirme que a conta GitHub "
                "logada tem uma assinatura ativa do Copilot e refaca o login."
            )
        if not response.ok:
            raise RuntimeError(f"Falha ao obter token do Copilot (HTTP {response.status_code}).")

        payload = response.json()
        token = payload.get("token")
        expires_at = payload.get("expires_at", time.time() + 1500)
        if not token:
            raise RuntimeError("Copilot nao retornou token valido.")

        _copilot_token_cache[github_token] = {"token": token, "expiresAt": expires_at}
        return token


def _extract_assistant_content(payload):
    choices = payload.get("choices") or []
    if not choices:
        return ""

    message = choices[0].get("message") or {}
    content = message.get("content")

    if isinstance(content, str):
        return content.strip()

    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict):
                parts.append(item.get("text") or item.get("content") or "")
        return "".join(parts).strip()

    return ""


def send_prompt_to_copilot(prompt, github_token=None, preferred_model=None):
    _acquire_copilot_slot()

    request_timeout_ms = _get_int_env("COPILOT_REQUEST_TIMEOUT_MS", 180000)
    per_model_timeout_ms = _get_int_env("COPILOT_PER_MODEL_TIMEOUT_MS", 90000)
    total_timeout_ms = _get_int_env("COPILOT_TOTAL_TIMEOUT_MS", 240000)
    model_candidates = get_copilot_model_candidates(preferred_model)
    started_at = time.time() * 1000

    token = (github_token or _get_fallback_github_token() or "").strip()
    if not token:
        _release_copilot_slot()
        raise RuntimeError("COPILOT_AUTH_MISSING_TOKEN")

    last_error = None
    token_refreshed = False
    try:
        copilot_token = _exchange_github_token_for_copilot_token(token)

        for model in model_candidates:
            if time.time() * 1000 - started_at >= total_timeout_ms:
                raise RuntimeError("COPILOT_TOTAL_TIMEOUT")

            remaining_total_ms = max(5000, total_timeout_ms - (time.time() * 1000 - started_at))
            current_timeout_s = min(request_timeout_ms, per_model_timeout_ms, remaining_total_ms) / 1000

            try:
                print(f"[{now_iso()}] [copilot] Tentando modelo: {model}")
                response = requests.post(
                    GITHUB_COPILOT_CHAT_URL,
                    headers={
                        "Authorization": f"Bearer {copilot_token}",
                        "Content-Type": "application/json",
                        "Accept": "application/json",
                        "User-Agent": _USER_AGENT,
                        "Editor-Version": _EDITOR_VERSION,
                        "Editor-Plugin-Version": _EDITOR_PLUGIN_VERSION,
                        "Copilot-Integration-Id": "vscode-chat",
                    },
                    json={
                        "model": model,
                        "messages": [{"role": "user", "content": prompt}],
                        "stream": False,
                    },
                    timeout=current_timeout_s,
                )

                if response.status_code == 401 and not token_refreshed:
                    # Token de sessao do Copilot expirou antes do previsto: renova uma vez e repete o modelo.
                    token_refreshed = True
                    _copilot_token_cache.pop(token, None)
                    copilot_token = _exchange_github_token_for_copilot_token(token)
                    raise RuntimeError("HTTP 401: token do Copilot expirado, renovado para o proximo modelo.")
                if response.status_code in (401, 403):
                    raise CopilotAuthError(f"HTTP {response.status_code}: acesso negado pelo Copilot.")
                if not response.ok:
                    raise RuntimeError(f"HTTP {response.status_code}: {response.text[:300]}")

                content = _extract_assistant_content(response.json())
                if not content:
                    raise RuntimeError("Copilot retornou resposta vazia.")

                print(f"[{now_iso()}] [copilot] Resposta recebida com modelo: {model}")
                return content
            except CopilotAuthError:
                raise
            except Exception as error:
                last_error = error
                print(f"[{now_iso()}] [copilot] Falha no modelo {model}: {error}")

        raise last_error or RuntimeError("Nenhum modelo disponivel respondeu com sucesso.")
    finally:
        _release_copilot_slot()


def get_copilot_status():
    with _copilot_slot_condition:
        active_requests = _active_copilot_requests
    return {
        "mode": "http-direct",
        "hasFallbackToken": bool(_get_fallback_github_token()),
        "queue": {
            "activeRequests": active_requests,
            "maxConcurrentRequests": _get_int_env("COPILOT_MAX_CONCURRENT_REQUESTS", 2),
        },
    }


class CopilotGateway:
    """Implementa a porta CopilotGateway (application/ports.py) sobre as funcoes deste modulo."""

    def send_prompt(self, prompt, github_token=None, preferred_model=None):
        return send_prompt_to_copilot(prompt, github_token=github_token, preferred_model=preferred_model)

    def get_model_candidates(self, preferred_model=None):
        return get_copilot_model_candidates(preferred_model)

    def get_status(self):
        return get_copilot_status()

