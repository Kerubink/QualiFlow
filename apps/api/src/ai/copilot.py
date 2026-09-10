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
import re
import threading
import time
from pathlib import Path

import requests

from ..core.json_utils import parse_json_loosely

_PROMPTS_DIR = Path(__file__).resolve().parent.parent.parent / "prompts"
_QA_TEMPLATE_PATH = _PROMPTS_DIR / "qa-test-prompt.txt"

_DEFAULT_QA_TEMPLATE = "\n".join(
    [
        "Voce e um especialista em QA e testes BDD.",
        "",
        "Gere exatamente 2 casos de teste em portugues brasileiro.",
        "Retorne somente JSON valido no formato:",
        '{"test_cases":[{...},{...}]}',
        "",
        "Pedido:",
        "{{USER_PROMPT}}",
    ]
)

_qa_template_cache = None

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


def _get_qa_template():
    global _qa_template_cache
    if _qa_template_cache:
        return _qa_template_cache

    try:
        _qa_template_cache = _QA_TEMPLATE_PATH.read_text(encoding="utf-8")
    except OSError as error:
        print(f"[{_now_iso()}] [copilot] Falha ao ler template de QA: {error}")
        _qa_template_cache = _DEFAULT_QA_TEMPLATE

    return _qa_template_cache


def build_qa_prompt(user_prompt):
    template = _get_qa_template()
    return template.replace("{{USER_PROMPT}}", user_prompt.strip())


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


def generate_scenarios_with_copilot(
    card_data, user_focus, technical_detail, generation_settings, github_token=None, preferred_model=None
):
    card_data = card_data or {}
    generation_settings = generation_settings or {}

    track = _detect_track_from_tags(card_data.get("tags"))
    objective = generation_settings.get("objective") or "All Objectives"
    test_type = generation_settings.get("type") or "Funcional"
    granularity = generation_settings.get("granularity") or "Detalhado"
    data_level = generation_settings.get("dataLevel") or "Massa de dados basica"

    objective_instruction = (
        "Gere uma suite de testes COMPLETA e ABRANGENTE, cobrindo de forma equilibrada o Fluxo Principal, "
        "Cenarios de Excecao, Casos de Borda e Regras de Negocio Complexas."
        if objective == "All Objectives"
        else f"FOCO NO OBJETIVO: {objective}."
    )

    existing_tests = card_data.get("existing_tests")

    prompt_task = {
        "role": "QA Senior",
        "objective": f"""Aja como QA Senior. Gere ou atualize Casos de Teste em BDD.
CONFIGURACAO DE GERACAO:
- Objetivo: {objective} ({objective_instruction})
- Tipo de Teste: {test_type}
- Estilo de Escrita: {granularity}
- Estrategia de Dados: {data_level}
Forneca metricas de cobertura com resumo qualitativo e score.
Retorne EXATAMENTE UM objeto JSON estrito com o formato especificado.""",
        "test_context": {
            "track": track,
            "focus": f"Foque em {objective}. Tipo de validacao: {test_type}. Estilo: {granularity}. "
            f"Estrategia de dados: {data_level}.",
            "special_instructions": objective_instruction,
        },
        "input_data": {
            "work_item": {
                "id": card_data.get("id"),
                "title": card_data.get("title"),
                "description": card_data.get("description"),
                "acceptance_criteria": card_data.get("acceptance_criteria"),
                "tags": card_data.get("tags"),
            },
            "user_technical_context": user_focus or "Nao informado pelo usuario.",
            "deep_technical_detail": technical_detail or "Nao informado.",
            "legacy_tests_for_upgrade": existing_tests if existing_tests else "Nenhum",
        },
        "formatting_rules": {
            "output_language": "Portugues do Brasil (pt-BR)",
            "acceptance_criteria_hierarchy": "Quando os criterios de aceite tiverem listas aninhadas ou "
            "subitens, preserve a hierarquia e trate cada subitem como um subcriterio distinto.",
            "gherkin_style": "O campo bdd_description DEVE ter os termos GHERKIN (DADO, QUANDO, ENTAO, E) "
            "no inicio de cada frase, com quebras de linha entre eles.",
            "step_style": "O campo action de CADA PASSO do array de passos DEVE tambem comecar com DADO, E, "
            "QUANDO ou ENTAO. IMPORTANTE: Deve haver EXATAMENTE UM passo comecando com QUANDO.",
            "naming_convention": {
                "structure": "[PREFIXO] - [Contexto/Componente]",
                "frontend_prefixes": ["UI", "FUNC", "UX", "ACC", "INT"],
                "backend_prefixes": ["SCHEMA", "FUNC", "SEG", "PERF", "INT"],
            },
            "step_detail": "Cada teste deve ter entre 6 e 10 passos claros.",
            "parameters": "IMPORTANTE: Use parametros explicitos com simbolo @ (ex.: @username, @role, "
            "@endpoint, @password) nos passos sempre que houver massa de dados dinamica.",
            "evidence": "Se um passo valida estado do sistema, mensagens de erro ou um sucesso critico de "
            "interface, defina needs_evidence: true para esse passo. Caso contrario, false.",
        },
        "expected_json_structure": {
            "total_criterios": 0,
            "total_tests": 0,
            "coverage_analysis": {
                "rtm_matrix": [{"criteria": "criterio", "covered_by_scenarios": ["Titulo do CT"], "status": "TOTAL"}],
                "insights": "Resumo qualitativo",
                "coverage_score": "100%",
            },
            "test_cases": [
                {
                    "title": "[PREFIXO] - Titulo",
                    "bdd_description": "DADO ...\nQUANDO ...\nENTAO ...",
                    "steps": [
                        {"action": "DADO ...", "expected": "...", "needs_evidence": False},
                        {"action": "QUANDO ...", "expected": "...", "needs_evidence": True},
                    ],
                    "parameters": {},
                }
            ],
        },
    }

    prompt = "\n\n".join(
        [
            "Voce e um gerador especialista de testes de software em BDD.",
            "Retorne APENAS um objeto JSON valido correspondente a estrutura esperada.",
            "Nao use markdown e nao use bloco de codigo.",
            json.dumps(prompt_task, ensure_ascii=False),
        ]
    )

    raw_response = send_prompt_to_copilot(prompt, github_token=github_token, preferred_model=preferred_model)
    return parse_json_loosely(raw_response)


def evaluate_coverage_with_copilot(card_data, github_token=None, preferred_model=None):
    card_data = card_data or {}
    existing_tests = card_data.get("existing_tests")
    if not existing_tests:
        return "Nao ha testes existentes para avaliar."

    prompt_text = f"""
Voce e um QA Senior.
Analise os Criterios de Aceite da historia abaixo e os Testes Existentes.
Avalie a cobertura. Ela esta boa? Faltam caminhos felizes, cenarios de erro ou validacoes de seguranca?

CRITERIOS DE ACEITE:
{card_data.get("acceptance_criteria")}

TESTES EXISTENTES (JSON):
{json.dumps(existing_tests, ensure_ascii=False)}

Responda em Portugues do Brasil com no maximo 3 paragrafos curtos e diretos, sem markdown pesado.
"""

    return send_prompt_to_copilot(prompt_text, github_token=github_token, preferred_model=preferred_model)


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
