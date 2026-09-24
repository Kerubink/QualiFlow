"""
Integracao com o GitHub Copilot via chamadas HTTP diretas (sem @github/copilot-sdk).

AVISO: api.githubcopilot.com/chat/completions e api.github.com/copilot_internal/v2/token
sao endpoints internos usados pelos editores oficiais (VS Code, Neovim, JetBrains) e NAO
sao uma API publica documentada/suportada pela GitHub. Este fluxo e o mesmo empregado por
integracoes de terceiros amplamente conhecidas na comunidade, mas pode mudar ou deixar de
funcionar sem aviso, e seu uso deve respeitar os Termos de Servico do GitHub Copilot.
"""
import json
import os
import threading
import time

import requests

from ..core.json_utils import parse_json_loosely
from . import prompt_registry

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

_copilot_slot_lock = threading.Lock()
_copilot_slot_condition = threading.Condition(_copilot_slot_lock)
_active_copilot_requests = 0


def _now_iso():
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _get_int_env(name, default_value):
    try:
        raw = int(os.environ.get(name, ""))
        return raw if raw > 0 else default_value
    except ValueError:
        return default_value


def build_qa_prompt(user_prompt):
    return prompt_registry.render(
        "system/qa_test_debug.j2",
        user_prompt=user_prompt.strip(),
        expected_json_structure=prompt_registry.schema_example("qa_test_debug.schema.json"),
    )


def _detect_track_from_tags(tags):
    normalized = (tags or "").lower()
    if "frontend" in normalized and "backend" not in normalized:
        return "Frontend"
    if "backend" in normalized and "frontend" not in normalized:
        return "Backend"
    return "Geral (Frontend e Backend)"


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
    max_concurrent = _get_int_env("COPILOT_MAX_CONCURRENT_REQUESTS", 1)
    timeout_seconds = _get_int_env("COPILOT_QUEUE_WAIT_TIMEOUT_MS", 30000) / 1000

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

    request_timeout_ms = _get_int_env("COPILOT_REQUEST_TIMEOUT_MS", 120000)
    per_model_timeout_ms = _get_int_env("COPILOT_PER_MODEL_TIMEOUT_MS", 45000)
    total_timeout_ms = _get_int_env("COPILOT_TOTAL_TIMEOUT_MS", 90000)
    model_candidates = get_copilot_model_candidates(preferred_model)
    started_at = time.time() * 1000

    token = (github_token or _get_fallback_github_token() or "").strip()
    if not token:
        _release_copilot_slot()
        raise RuntimeError("COPILOT_AUTH_MISSING_TOKEN")

    last_error = None
    try:
        copilot_token = _exchange_github_token_for_copilot_token(token)

        for model in model_candidates:
            if time.time() * 1000 - started_at >= total_timeout_ms:
                raise RuntimeError("COPILOT_TOTAL_TIMEOUT")

            remaining_total_ms = max(5000, total_timeout_ms - (time.time() * 1000 - started_at))
            current_timeout_s = min(request_timeout_ms, per_model_timeout_ms, remaining_total_ms) / 1000

            try:
                print(f"[{_now_iso()}] [copilot] Tentando modelo: {model}")
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

                if not response.ok:
                    raise RuntimeError(f"HTTP {response.status_code}: {response.text[:300]}")

                content = _extract_assistant_content(response.json())
                if not content:
                    raise RuntimeError("Copilot retornou resposta vazia.")

                print(f"[{_now_iso()}] [copilot] Resposta recebida com modelo: {model}")
                return content
            except Exception as error:
                last_error = error
                print(f"[{_now_iso()}] [copilot] Falha no modelo {model}: {error}")

        raise last_error or RuntimeError("Nenhum modelo disponivel respondeu com sucesso.")
    finally:
        _release_copilot_slot()


def build_qa_generation_prompt(card_data, user_focus, technical_detail, generation_settings):
    """Monta o prompt de geracao de cenarios a partir de um card e das configuracoes de geracao.

    Usada tanto pelo endpoint dedicado do Copilot (generate_scenarios_with_copilot) quanto pelo
    fallback single-shot de src.ai.orchestration.legacy_generate_scenarios -- um unico lugar
    define o que "gerar casos de teste" significa, independente do provedor de IA por tras.
    """
    card_data = card_data or {}
    generation_settings = generation_settings or {}

    track = _detect_track_from_tags(card_data.get("tags"))
    objective = generation_settings.get("objective") or "All Objectives"
    test_type = generation_settings.get("type") or "Funcional"
    granularity = generation_settings.get("granularity") or "Detalhado"
    data_level = generation_settings.get("dataLevel") or "Massa de dados basica"

    existing_tests = card_data.get("existing_tests")
    legacy_tests_for_upgrade = json.dumps(existing_tests, ensure_ascii=False) if existing_tests else "Nenhum"

    return prompt_registry.render(
        "system/qa_generator.j2",
        track=track,
        objective=objective,
        test_type=test_type,
        granularity=granularity,
        data_level=data_level,
        work_item={
            "id": card_data.get("id"),
            "title": card_data.get("title"),
            "description": card_data.get("description"),
            "acceptance_criteria": card_data.get("acceptance_criteria"),
            "tags": card_data.get("tags"),
        },
        user_technical_context=user_focus or "Nao informado pelo usuario.",
        deep_technical_detail=technical_detail or "Nao informado.",
        legacy_tests_for_upgrade=legacy_tests_for_upgrade,
        expected_json_structure=prompt_registry.schema_example("qa_test_case.schema.json"),
    )


def generate_scenarios_with_copilot(
    card_data, user_focus, technical_detail, generation_settings, github_token=None, preferred_model=None
):
    prompt = build_qa_generation_prompt(card_data, user_focus, technical_detail, generation_settings)

    raw_response = send_prompt_to_copilot(prompt, github_token=github_token, preferred_model=preferred_model)
    parsed_response = parse_json_loosely(raw_response)
    prompt_registry.validate_against_schema("qa_test_case.schema.json", parsed_response)
    return parsed_response


def build_qa_evaluation_prompt(card_data):
    """Monta o prompt de avaliacao de cobertura. Compartilhada com
    src.ai.orchestration.evaluate_coverage pelo mesmo motivo de build_qa_generation_prompt."""
    card_data = card_data or {}
    return prompt_registry.render(
        "system/qa_evaluator.j2",
        acceptance_criteria=card_data.get("acceptance_criteria"),
        existing_tests=card_data.get("existing_tests"),
    )


def evaluate_coverage_with_copilot(card_data, github_token=None, preferred_model=None):
    card_data = card_data or {}
    if not card_data.get("existing_tests"):
        return "Nao ha testes existentes para avaliar."

    prompt = build_qa_evaluation_prompt(card_data)
    return send_prompt_to_copilot(prompt, github_token=github_token, preferred_model=preferred_model)


def classify_copilot_error(error):
    raw_message = str(error)
    message = raw_message or "Erro desconhecido."
    normalized = message.lower()

    if "copilot_auth_missing_token" in normalized:
        return {
            "httpStatus": 401,
            "code": "COPILOT_AUTH_MISSING_TOKEN",
            "message": "Nenhum token do GitHub disponivel para autenticar no Copilot.",
        }

    if "personal access tokens are not supported" in normalized or " pat" in normalized:
        return {
            "httpStatus": 401,
            "code": "COPILOT_AUTH_UNSUPPORTED_TOKEN",
            "message": "Token nao suportado para este fluxo. Evite ghp_ (PAT classico). Use github_pat_ "
            "(fine-grained), gho_/ghu_ (OAuth/App user) ou ghs_ (installation token via COPILOT_GITHUB_TOKEN).",
        }

    if "401" in normalized or "403" in normalized or "bad credentials" in normalized:
        return {
            "httpStatus": 401,
            "code": "COPILOT_AUTH_ERROR",
            "message": "Falha de autenticacao no GitHub Copilot. Verifique token/login.",
        }

    if "timeout" in normalized:
        return {
            "httpStatus": 504,
            "code": "COPILOT_TIMEOUT",
            "message": "Tempo limite excedido na comunicacao com o Copilot.",
        }

    if "invalid_json_response" in normalized:
        return {
            "httpStatus": 502,
            "code": "COPILOT_INVALID_JSON_RESPONSE",
            "message": "Copilot respondeu fora do formato JSON esperado. Tente novamente.",
        }

    if "copilot_queue_timeout" in normalized:
        return {
            "httpStatus": 503,
            "code": "COPILOT_BUSY",
            "message": "Servico temporariamente ocupado. Tente novamente em alguns segundos.",
        }

    return {
        "httpStatus": 500,
        "code": "COPILOT_REQUEST_ERROR",
        "message": "Erro ao processar prompt com o Copilot.",
    }


def get_copilot_status():
    with _copilot_slot_condition:
        active_requests = _active_copilot_requests
    return {
        "mode": "http-direct",
        "hasFallbackToken": bool(_get_fallback_github_token()),
        "queue": {
            "activeRequests": active_requests,
            "maxConcurrentRequests": _get_int_env("COPILOT_MAX_CONCURRENT_REQUESTS", 1),
        },
    }
