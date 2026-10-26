"""Endpoints dedicados do Copilot (/api/copilot/*), protegidos por sessao GitHub OAuth."""
from flask import Blueprint, jsonify, request

from ...auth.interface.middleware import require_auth_session
from ...shared.clock import now_iso
from ...shared.interface.responses import error_response, is_development, set_metric_error_code
from ..container import copilot_service
from ..domain.errors import classify_copilot_error

copilot_routes = Blueprint("copilot_routes", __name__)


def _invalid_body(message):
    set_metric_error_code("INVALID_BODY")
    return error_response("INVALID_BODY", message, 400)


def _copilot_error_response(error):
    normalized = classify_copilot_error(error)
    set_metric_error_code(normalized["code"])
    return normalized, (
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


@copilot_routes.get("/api/copilot/models")
@require_auth_session
def copilot_models():
    return jsonify({"success": True, "models": copilot_service.get_model_candidates()})


@copilot_routes.post("/api/copilot/generate")
@require_auth_session
def copilot_generate():
    body = request.get_json(silent=True) or {}
    card_data = body.get("cardData")
    model = body.get("model")

    if not card_data or not isinstance(card_data, dict):
        return _invalid_body("Body invalido. Envie cardData no payload.")

    try:
        scenarios = copilot_service.generate_scenarios(
            card_data,
            body.get("userFocus"),
            body.get("technicalDetail"),
            body.get("generationSettings"),
            github_token=request.auth_session["accessToken"],
            preferred_model=model.strip() if isinstance(model, str) else None,
        )
        return jsonify({"success": True, "scenarios": scenarios})
    except Exception as error:
        normalized, response = _copilot_error_response(error)
        print(f"[{now_iso()}] [copilot] generate error classified: {normalized['code']} ({normalized['httpStatus']})")
        return response


@copilot_routes.post("/api/copilot/evaluate")
@require_auth_session
def copilot_evaluate():
    body = request.get_json(silent=True) or {}
    card_data = body.get("cardData")
    model = body.get("model")

    if not card_data or not isinstance(card_data, dict):
        return _invalid_body("Body invalido. Envie cardData no payload.")

    try:
        result = copilot_service.evaluate_coverage(
            card_data,
            github_token=request.auth_session["accessToken"],
            preferred_model=model.strip() if isinstance(model, str) else None,
        )
        return jsonify({"success": True, "result": result})
    except Exception as error:
        _normalized, response = _copilot_error_response(error)
        return response


@copilot_routes.post("/api/copilot/test")
@require_auth_session
def copilot_test():
    body = request.get_json(silent=True) or {}
    prompt = body.get("prompt")

    if not isinstance(prompt, str) or not prompt.strip():
        return _invalid_body('Body invalido. Envie { "prompt": "string" }.')

    try:
        response_text = copilot_service.test_prompt(prompt, request.auth_session["accessToken"])

        return jsonify(
            {
                "success": True,
                "response": response_text,
                "user": {
                    "login": request.auth_session["user"].get("login"),
                    "id": request.auth_session["user"].get("id"),
                },
            }
        )
    except Exception as error:
        _normalized, response = _copilot_error_response(error)
        print(f"[copilot] Erro ao processar requisicao: {error}")
        return response
