"""Rotas operacionais: /health e /metrics/*."""
import os
import time

from flask import Blueprint, jsonify, request

from ...generation.container import copilot_service
from ...shared.interface.responses import error_response
from ...shared.request_metrics import get_request_metrics_report, reset_request_metrics
from ...shared.runtime_metrics import get_runtime_metrics_snapshot

ops_routes = Blueprint("ops_routes", __name__)

_START_TIME = time.time()


def _has_metrics_admin_access():
    configured_key = (os.environ.get("METRICS_ADMIN_KEY") or "").strip()
    if not configured_key:
        return True

    provided_key = (request.headers.get("X-Metrics-Key") or "").strip() or (request.args.get("key") or "").strip()
    return provided_key == configured_key


@ops_routes.get("/health")
def health():
    return jsonify(
        {
            "success": True,
            "service": "qualiflow-copilot-poc-backend",
            "uptimeSeconds": round(time.time() - _START_TIME),
            "copilot": copilot_service.get_status(),
            "runtime": get_runtime_metrics_snapshot(),
            "authMode": "github-oauth-session",
        }
    )


@ops_routes.get("/metrics/runtime")
def metrics_runtime():
    return jsonify({"success": True, "runtime": get_runtime_metrics_snapshot()})


@ops_routes.get("/metrics/report")
def metrics_report():
    if not _has_metrics_admin_access():
        return error_response("METRICS_FORBIDDEN", "Acesso negado ao relatorio de metricas.", 403)

    return jsonify(
        {
            "success": True,
            "report": get_request_metrics_report(),
            "runtime": get_runtime_metrics_snapshot(),
            "copilot": copilot_service.get_status(),
        }
    )


@ops_routes.post("/metrics/reset")
def metrics_reset():
    if not _has_metrics_admin_access():
        return error_response("METRICS_FORBIDDEN", "Acesso negado ao reset de metricas.", 403)

    reset_request_metrics()
    return jsonify({"success": True, "message": "Janela de metricas reiniciada."})
