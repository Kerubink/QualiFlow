"""Hooks HTTP globais da aplicacao: metricas por requisicao, log de acesso e erro 400 de JSON."""
import time

from flask import g, jsonify, request

from ..log import log
from ..session_store import get_user_session
from ..request_metrics import begin_request_metric, end_request_metric
from .responses import set_metric_error_code


_NOISY_PATHS = ("/health", "/metrics", "/favicon.ico", "/auth/session/poll/")


def _is_noise(path, status_code):
    """Health checks e polling de login pendente repetem a cada poucos segundos e poluem o terminal."""
    return status_code < 400 and path.startswith(_NOISY_PATHS)


def register_http_hooks(app):
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
        if _is_noise(request.path, response.status_code):
            return response
        header = request.headers.get("Authorization") or ""
        session = get_user_session(header[7:].strip()) if header.lower().startswith("bearer ") else None
        log(
            "http",
            f"{request.method} {request.path} {response.status_code}",
            duracao=f"{round(duration_ms)}ms",
            usuario=((session or {}).get("user") or {}).get("login") or ((session or {}).get("user") or {}).get("displayName"),
            erro=g.get("metric_error_code"),
        )
        return response

    @app.errorhandler(400)
    def _handle_bad_request(error):
        set_metric_error_code("INVALID_JSON")
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
