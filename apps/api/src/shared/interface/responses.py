"""Helpers HTTP compartilhados pela camada de interface (Flask) dos contextos."""
import os

from flask import g, jsonify


def is_development():
    return (os.environ.get("FLASK_ENV") or "").strip().lower() == "development"


def set_metric_error_code(code):
    g.metric_error_code = code


def error_response(code, message, status, **extra):
    """Formato de erro padrao da API: {"success": False, "error": {"code", "message", ...}}."""
    return jsonify({"success": False, "error": {"code": code, "message": message, **extra}}), status
