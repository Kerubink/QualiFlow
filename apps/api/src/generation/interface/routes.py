"""Endpoints genericos de geracao/adaptacao/avaliacao de cenarios (Gemini/Groq/Copilot)."""
import json

from flask import Blueprint, Response, jsonify, request, stream_with_context

from ...auth.interface.middleware import github_session_or_error
from ...shared.interface.responses import error_response, is_development
from ..container import generation_service
from ..domain.ai_providers import normalize_selected_ai
from ..domain.errors import classify_ai_error

scenario_routes = Blueprint("scenario_routes", __name__)


def _resolve_github_token(selected_ai):
    """So exige sessao GitHub OAuth quando o provedor selecionado for o Copilot."""
    if selected_ai != "copilot":
        return None, None

    session, error = github_session_or_error()
    if error:
        return None, error

    return session["accessToken"], None


def _ndjson_line(payload):
    return json.dumps(payload, ensure_ascii=False) + "\n"


def _to_ndjson(event):
    """Serializa um evento do servico de aplicacao (progress/result/error) como linha NDJSON."""
    if event["type"] != "error":
        return _ndjson_line(event)

    normalized = event["error"]
    return _ndjson_line(
        {
            "type": "error",
            "error": {
                "code": normalized["code"],
                "message": normalized["message"],
                "details": str(event["cause"]) if is_development() else None,
            },
        }
    )


# O Chrome segura o inicio de respostas "sem tipo conhecido" (como application/x-ndjson) ate juntar ~1 KB para
# detectar o tipo (MIME sniffing); como cada evento de progresso tem ~150 bytes, o front ficava parado e recebia tudo
# de uma vez no fim. `nosniff` desliga esse buffer e o preenchimento inicial cobre proxies/antivirus que tambem
# acumulam bytes. O cliente ignora eventos de tipo desconhecido.
_STREAM_PADDING = _ndjson_line({"type": "padding", "data": " " * 1100})


def _ndjson_response(events):
    def generate():
        yield _STREAM_PADDING
        for event in events:
            yield _to_ndjson(event)

    return Response(
        stream_with_context(generate()),
        mimetype="application/x-ndjson",
        headers={
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
        },
    )


@scenario_routes.post("/api/gemini/models")
def gemini_models():
    body = request.get_json(silent=True) or {}
    try:
        models = generation_service.list_gemini_models(body.get("geminiKey"))
        return jsonify({"success": True, "models": models})
    except Exception as error:
        return error_response("GEMINI_MODELS_ERROR", str(error), 502)


@scenario_routes.post("/api/groq/models")
def groq_models():
    body = request.get_json(silent=True) or {}
    try:
        models = generation_service.list_groq_models(body.get("groqKey"))
        return jsonify({"success": True, "models": models})
    except Exception as error:
        return error_response("GROQ_MODELS_ERROR", str(error), 502)


@scenario_routes.post("/api/coverage/evaluate")
def coverage_evaluate():
    body = request.get_json(silent=True) or {}
    selected_ai = normalize_selected_ai(body.get("selectedAi"))
    card_data = body.get("cardData")
    ai_settings = body.get("aiSettings") or {}

    if not card_data or not isinstance(card_data, dict):
        return error_response("INVALID_BODY", "Body invalido. Envie cardData no payload.", 400)

    github_token, auth_error = _resolve_github_token(selected_ai)
    if auth_error:
        return auth_error

    try:
        result = generation_service.evaluate_coverage(selected_ai, card_data, ai_settings, github_token=github_token)
        return jsonify({"success": True, "result": result})
    except Exception as error:
        normalized = classify_ai_error(selected_ai, error)
        return (
            jsonify(
                {
                    "success": False,
                    "error": {
                        "code": normalized["code"],
                        "message": normalized["message"],
                        "details": str(error) if is_development() else None,
                    },
                }
            ),
            normalized["httpStatus"],
        )


@scenario_routes.post("/api/scenarios/generate")
def scenarios_generate():
    body = request.get_json(silent=True) or {}
    selected_ai = normalize_selected_ai(body.get("selectedAi"))
    card_data = body.get("cardData")
    ai_settings = body.get("aiSettings") or {}

    if not card_data or not isinstance(card_data, dict):
        return error_response("INVALID_BODY", "Body invalido. Envie cardData no payload.", 400)

    github_token, auth_error = _resolve_github_token(selected_ai)
    if auth_error:
        return auth_error

    return _ndjson_response(
        generation_service.stream_generation(
            selected_ai,
            ai_settings,
            card_data,
            body.get("userFocus"),
            body.get("technicalDetail"),
            body.get("generationSettings"),
            github_token=github_token,
        )
    )


@scenario_routes.post("/api/scenarios/adapt")
def scenarios_adapt():
    body = request.get_json(silent=True) or {}
    selected_ai = normalize_selected_ai(body.get("selectedAi"))
    target_card_data = body.get("targetCardData")
    ai_settings = body.get("aiSettings") or {}
    copied_scenarios = body.get("copiedScenarios") or []
    copy_context = body.get("copyContext") or {}

    if not target_card_data or not isinstance(target_card_data, dict):
        return error_response("INVALID_BODY", "Body invalido. Envie targetCardData no payload.", 400)

    github_token, auth_error = _resolve_github_token(selected_ai)
    if auth_error:
        return auth_error

    return _ndjson_response(
        generation_service.stream_adaptation(
            selected_ai,
            ai_settings,
            target_card_data,
            {"id": copy_context.get("sourceWorkItemId"), "title": copy_context.get("sourceWorkItemTitle")},
            copied_scenarios,
            body.get("userFocus"),
            body.get("technicalDetail"),
            body.get("generationSettings"),
            github_token=github_token,
        )
    )
