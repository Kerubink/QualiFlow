"""Endpoints genericos de geracao/adaptacao/avaliacao de cenarios (Gemini/Groq/Copilot)."""
import json
import os

from flask import Blueprint, Response, jsonify, request, stream_with_context

from .providers import fetch_gemini_models, fetch_groq_models
from ..auth.middleware import resolve_session_token
from .orchestration import (
    classify_ai_error,
    evaluate_coverage,
    legacy_generate_scenarios,
    orchestrate_scenario_adaptation,
    orchestrate_scenario_generation,
    post_process_generated_scenarios,
)
from ..core.session_store import get_user_session

scenario_routes = Blueprint("scenario_routes", __name__)

SUPPORTED_PROVIDERS = {"gemini", "groq", "copilot"}


def _normalize_selected_ai(value):
    value = (value or "").strip().lower()
    return value if value in SUPPORTED_PROVIDERS else "gemini"


def _is_development():
    return (os.environ.get("FLASK_ENV") or "").strip().lower() == "development"


def _resolve_github_token(selected_ai):
    """So exige sessao GitHub OAuth quando o provedor selecionado for o Copilot."""
    if selected_ai != "copilot":
        return None, None

    session_token = resolve_session_token(request)
    if not session_token:
        return None, (
            jsonify(
                {
                    "success": False,
                    "error": {
                        "code": "AUTH_REQUIRED",
                        "message": "Sessao ausente. Faca login em /auth/github/login e envie "
                        "Authorization: Bearer <sessionToken>.",
                    },
                }
            ),
            401,
        )

    session = get_user_session(session_token)
    if not session:
        return None, (
            jsonify(
                {
                    "success": False,
                    "error": {"code": "AUTH_SESSION_INVALID", "message": "Sessao invalida ou expirada. Refaca o login no GitHub."},
                }
            ),
            401,
        )

    return session["accessToken"], None


def _ndjson_line(payload):
    return json.dumps(payload, ensure_ascii=False) + "\n"


@scenario_routes.post("/api/gemini/models")
def gemini_models():
    body = request.get_json(silent=True) or {}
    try:
        models = fetch_gemini_models(body.get("geminiKey"))
        return jsonify({"success": True, "models": models})
    except Exception as error:
        return jsonify({"success": False, "error": {"code": "GEMINI_MODELS_ERROR", "message": str(error)}}), 502


@scenario_routes.post("/api/groq/models")
def groq_models():
    body = request.get_json(silent=True) or {}
    try:
        models = fetch_groq_models(body.get("groqKey"))
        return jsonify({"success": True, "models": models})
    except Exception as error:
        return jsonify({"success": False, "error": {"code": "GROQ_MODELS_ERROR", "message": str(error)}}), 502


@scenario_routes.post("/api/coverage/evaluate")
def coverage_evaluate():
    body = request.get_json(silent=True) or {}
    selected_ai = _normalize_selected_ai(body.get("selectedAi"))
    card_data = body.get("cardData")
    ai_settings = body.get("aiSettings") or {}

    if not card_data or not isinstance(card_data, dict):
        return (
            jsonify({"success": False, "error": {"code": "INVALID_BODY", "message": "Body invalido. Envie cardData no payload."}}),
            400,
        )

    github_token, error_response = _resolve_github_token(selected_ai)
    if error_response:
        return error_response

    try:
        result = evaluate_coverage(selected_ai, card_data, ai_settings, github_token=github_token)
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
                        "details": str(error) if _is_development() else None,
                    },
                }
            ),
            normalized["httpStatus"],
        )


def _stream_scenarios(generator_factory, card_data, selected_ai, ai_settings, github_token, user_focus, technical_detail, generation_settings):
    def generate():
        try:
            final_result = None
            for kind, payload in generator_factory():
                if kind == "progress":
                    yield _ndjson_line({"type": "progress", **payload})
                else:
                    final_result = payload

            if final_result is None:
                raise RuntimeError("Orquestracao nao retornou resultado.")

            processed = post_process_generated_scenarios(final_result, card_data)
            yield _ndjson_line({"type": "result", "data": processed})
        except Exception as error:
            try:
                yield _ndjson_line({"type": "progress", "stage": "fallback", "message": "Executando fluxo legado de geracao..."})
                raw = legacy_generate_scenarios(
                    selected_ai,
                    ai_settings,
                    card_data,
                    user_focus,
                    technical_detail,
                    generation_settings,
                    github_token=github_token,
                )
                processed = post_process_generated_scenarios(raw, card_data)
                yield _ndjson_line({"type": "result", "data": processed})
            except Exception as fallback_error:
                normalized = classify_ai_error(selected_ai, fallback_error)
                yield _ndjson_line(
                    {
                        "type": "error",
                        "error": {
                            "code": normalized["code"],
                            "message": normalized["message"],
                            "details": str(fallback_error) if _is_development() else None,
                        },
                    }
                )

    return Response(stream_with_context(generate()), mimetype="application/x-ndjson")


@scenario_routes.post("/api/scenarios/generate")
def scenarios_generate():
    body = request.get_json(silent=True) or {}
    selected_ai = _normalize_selected_ai(body.get("selectedAi"))
    card_data = body.get("cardData")
    ai_settings = body.get("aiSettings") or {}

    if not card_data or not isinstance(card_data, dict):
        return (
            jsonify({"success": False, "error": {"code": "INVALID_BODY", "message": "Body invalido. Envie cardData no payload."}}),
            400,
        )

    github_token, error_response = _resolve_github_token(selected_ai)
    if error_response:
        return error_response

    def generator_factory():
        return orchestrate_scenario_generation(
            selected_ai,
            ai_settings,
            card_data,
            body.get("userFocus"),
            body.get("technicalDetail"),
            body.get("generationSettings"),
            github_token=github_token,
        )

    return _stream_scenarios(
        generator_factory,
        card_data,
        selected_ai,
        ai_settings,
        github_token,
        body.get("userFocus"),
        body.get("technicalDetail"),
        body.get("generationSettings"),
    )


@scenario_routes.post("/api/scenarios/adapt")
def scenarios_adapt():
    body = request.get_json(silent=True) or {}
    selected_ai = _normalize_selected_ai(body.get("selectedAi"))
    target_card_data = body.get("targetCardData")
    ai_settings = body.get("aiSettings") or {}
    copied_scenarios = body.get("copiedScenarios") or []
    copy_context = body.get("copyContext") or {}

    if not target_card_data or not isinstance(target_card_data, dict):
        return (
            jsonify({"success": False, "error": {"code": "INVALID_BODY", "message": "Body invalido. Envie targetCardData no payload."}}),
            400,
        )

    github_token, error_response = _resolve_github_token(selected_ai)
    if error_response:
        return error_response

    def generate():
        try:
            final_result = None
            for kind, payload in orchestrate_scenario_adaptation(
                selected_ai,
                ai_settings,
                target_card_data,
                {"id": copy_context.get("sourceWorkItemId"), "title": copy_context.get("sourceWorkItemTitle")},
                copied_scenarios,
                body.get("userFocus"),
                body.get("technicalDetail"),
                body.get("generationSettings"),
                github_token=github_token,
            ):
                if kind == "progress":
                    yield _ndjson_line({"type": "progress", **payload})
                else:
                    final_result = payload

            if final_result is None:
                raise RuntimeError("Orquestracao de adaptacao nao retornou resultado.")

            processed = post_process_generated_scenarios(final_result, target_card_data)
            yield _ndjson_line({"type": "result", "data": processed})
        except Exception as error:
            normalized = classify_ai_error(selected_ai, error)
            yield _ndjson_line(
                {
                    "type": "error",
                    "error": {
                        "code": normalized["code"],
                        "message": normalized["message"],
                        "details": str(error) if _is_development() else None,
                    },
                }
            )

    return Response(stream_with_context(generate()), mimetype="application/x-ndjson")
