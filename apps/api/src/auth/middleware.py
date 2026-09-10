"""Validacao de sessao autenticada via Authorization: Bearer <sessionToken>."""
from functools import wraps

from flask import jsonify, request

from ..core.session_store import get_user_session


def _extract_bearer_token(authorization_header):
    if not authorization_header:
        return ""

    parts = authorization_header.split(" ")
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return ""

    return parts[1].strip()


def resolve_session_token(req=None):
    req = req or request
    header_token = _extract_bearer_token(req.headers.get("Authorization"))
    if header_token:
        return header_token

    return (req.headers.get("X-Session-Token") or "").strip()


def require_auth_session(view_func):
    @wraps(view_func)
    def wrapper(*args, **kwargs):
        session_token = resolve_session_token(request)
        if not session_token:
            return (
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
            return (
                jsonify(
                    {
                        "success": False,
                        "error": {
                            "code": "AUTH_SESSION_INVALID",
                            "message": "Sessao invalida ou expirada. Refaca o login no GitHub.",
                        },
                    }
                ),
                401,
            )

        request.auth_session = session
        return view_func(*args, **kwargs)

    return wrapper
