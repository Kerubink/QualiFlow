"""Aplicacao Flask principal: rotas de health/metrics/copilot e bootstrap do servidor."""
import os
import time
from datetime import datetime, timezone

from dotenv import load_dotenv
from flask import Flask, g, jsonify, request

load_dotenv()

from .auth.middleware import require_auth_session
from .auth.routes import auth_routes
from .auth.board_routes import board_auth_routes
from .ai.copilot import (
    build_qa_prompt,
    classify_copilot_error,
    evaluate_coverage_with_copilot,
    generate_scenarios_with_copilot,
    get_copilot_model_candidates,
    get_copilot_status,
    send_prompt_to_copilot,
)
from .core.request_metrics import (
    begin_request_metric,
    end_request_metric,
    get_request_metrics_report,
    reset_request_metrics,
)
from .core.runtime_metrics import get_runtime_metrics_snapshot, start_runtime_metrics_logger, stop_runtime_metrics_logger
from .boards.routes import board_routes
from .ai.routes import scenario_routes

app = Flask(__name__)
app.register_blueprint(auth_routes)
app.register_blueprint(board_auth_routes)
app.register_blueprint(board_routes)
app.register_blueprint(scenario_routes)

_START_TIME = time.time()


def _now_iso():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _is_development():
    return (os.environ.get("FLASK_ENV") or "").strip().lower() == "development"


def _set_metric_error_code(code):
    g.metric_error_code = code


@app.before_request
def _before_request():
    g.request_started_at = begin_request_metric()
    g.metric_error_code = None


@app.after_request
def _after_request(response):
    duration_ms = (time.time() * 1000) - g.get("request_started_at", time.time() * 1000)
    route_path = request.url_rule.rule if request.url_rule else request.path
    end_request_metric(
        request.method, route_path, response.status_code, g.get("metric_error_code"), duration_ms
    )
    print(
        f"[{_now_iso()}] [http] {request.method} {request.path} {response.status_code} {round(duration_ms)}ms"
    )
    return response


@app.errorhandler(400)
def _handle_bad_request(error):
    _set_metric_error_code("INVALID_JSON")
    return (
        jsonify(
            {
                "success": False,
                "error": {
                    "code": "INVALID_JSON",
                    "message": "JSON invalido no body. Verifique aspas e escapamento.",
                },
            }
        ),
        400,
    )


@app.get("/health")
def health():
    return jsonify(
        {
            "success": True,
            "service": "qualiflow-copilot-poc-backend",
            "uptimeSeconds": round(time.time() - _START_TIME),
            "copilot": get_copilot_status(),
            "runtime": get_runtime_metrics_snapshot(),
            "authMode": "github-oauth-session",
        }
    )


@app.get("/metrics/runtime")
def metrics_runtime():
    return jsonify({"success": True, "runtime": get_runtime_metrics_snapshot()})


def _has_metrics_admin_access():
    configured_key = (os.environ.get("METRICS_ADMIN_KEY") or "").strip()
    if not configured_key:
        return True

    provided_key = (request.headers.get("X-Metrics-Key") or "").strip() or (request.args.get("key") or "").strip()
    return provided_key == configured_key


@app.get("/metrics/report")
def metrics_report():
    if not _has_metrics_admin_access():
        return (
            jsonify(
                {"success": False, "error": {"code": "METRICS_FORBIDDEN", "message": "Acesso negado ao relatorio de metricas."}}
            ),
            403,
        )

    return jsonify(
        {
            "success": True,
            "report": get_request_metrics_report(),
            "runtime": get_runtime_metrics_snapshot(),
            "copilot": get_copilot_status(),
        }
    )


@app.post("/metrics/reset")
def metrics_reset():
    if not _has_metrics_admin_access():
        return (
            jsonify(
                {"success": False, "error": {"code": "METRICS_FORBIDDEN", "message": "Acesso negado ao reset de metricas."}}
            ),
            403,
        )

    reset_request_metrics()
    return jsonify({"success": True, "message": "Janela de metricas reiniciada."})


@app.get("/api/copilot/models")
@require_auth_session
def copilot_models():
    return jsonify({"success": True, "models": get_copilot_model_candidates()})


@app.post("/api/copilot/generate")
@require_auth_session
def copilot_generate():
    body = request.get_json(silent=True) or {}
    card_data = body.get("cardData")
    user_focus = body.get("userFocus")
    technical_detail = body.get("technicalDetail")
    generation_settings = body.get("generationSettings")
    model = body.get("model")

    if not card_data or not isinstance(card_data, dict):
        _set_metric_error_code("INVALID_BODY")
        return (
            jsonify(
                {"success": False, "error": {"code": "INVALID_BODY", "message": "Body invalido. Envie cardData no payload."}}
            ),
            400,
        )

    try:
        scenarios = generate_scenarios_with_copilot(
            card_data,
            user_focus,
            technical_detail,
            generation_settings,
            github_token=request.auth_session["accessToken"],
            preferred_model=model.strip() if isinstance(model, str) else None,
        )
        return jsonify({"success": True, "scenarios": scenarios})
    except Exception as error:
        normalized = classify_copilot_error(error)
        _set_metric_error_code(normalized["code"])
        print(f"[{_now_iso()}] [copilot] generate error classified: {normalized['code']} ({normalized['httpStatus']})")
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


@app.post("/api/copilot/evaluate")
@require_auth_session
def copilot_evaluate():
    body = request.get_json(silent=True) or {}
    card_data = body.get("cardData")
    model = body.get("model")

    if not card_data or not isinstance(card_data, dict):
        _set_metric_error_code("INVALID_BODY")
        return (
            jsonify(
                {"success": False, "error": {"code": "INVALID_BODY", "message": "Body invalido. Envie cardData no payload."}}
            ),
            400,
        )

    try:
        result = evaluate_coverage_with_copilot(
            card_data,
            github_token=request.auth_session["accessToken"],
            preferred_model=model.strip() if isinstance(model, str) else None,
        )
        return jsonify({"success": True, "result": result})
    except Exception as error:
        normalized = classify_copilot_error(error)
        _set_metric_error_code(normalized["code"])
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


@app.post("/api/copilot/test")
@require_auth_session
def copilot_test():
    body = request.get_json(silent=True) or {}
    prompt = body.get("prompt")

    if not isinstance(prompt, str) or not prompt.strip():
        _set_metric_error_code("INVALID_BODY")
        return (
            jsonify(
                {
                    "success": False,
                    "error": {"code": "INVALID_BODY", "message": 'Body invalido. Envie { "prompt": "string" }.'},
                }
            ),
            400,
        )

    try:
        qa_prompt = build_qa_prompt(prompt)
        response_text = send_prompt_to_copilot(qa_prompt, github_token=request.auth_session["accessToken"])

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
        normalized = classify_copilot_error(error)
        _set_metric_error_code(normalized["code"])
        print(f"[copilot] Erro ao processar requisicao: {error}")

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


def _bootstrap():
    metrics_enabled = (os.environ.get("RUNTIME_METRICS_LOG_ENABLED") or "true").strip().lower() != "false"
    try:
        metrics_interval_ms = int(os.environ.get("RUNTIME_METRICS_LOG_INTERVAL_MS", "60000"))
    except ValueError:
        metrics_interval_ms = 60000

    start_runtime_metrics_logger(enabled=metrics_enabled, interval_ms=metrics_interval_ms)


_bootstrap()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "3000"))
    try:
        app.run(host="0.0.0.0", port=port, threaded=True)
    finally:
        stop_runtime_metrics_logger()
