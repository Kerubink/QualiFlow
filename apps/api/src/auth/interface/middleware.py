"""Validacao de sessao autenticada via Authorization: Bearer <sessionToken> (Flask)."""
from functools import wraps

from flask import request

from ...shared.interface.responses import error_response
from ..container import login_service
from ..domain.session_tokens import is_github_session, resolve_session_token_from_headers


def resolve_session_token(req=None):
    req = req or request
    return resolve_session_token_from_headers(req.headers)


def github_session_or_error():
    """Retorna (session, None) para uma sessao GitHub valida, ou (None, resposta_401) caso contrario."""
    session_token = resolve_session_token(request)
    if not session_token:
        return None, error_response(
            "AUTH_REQUIRED",
            "Sessao ausente. Faca login em /auth/github/login e envie Authorization: Bearer <sessionToken>.",
            401,
        )

    session = login_service.get_session(session_token)
    if not session or not is_github_session(session):
        return None, error_response(
            "AUTH_SESSION_INVALID", "Sessao invalida ou expirada. Refaca o login no GitHub.", 401
        )

    return session, None


def require_auth_session(view_func):
    @wraps(view_func)
    def wrapper(*args, **kwargs):
        session, error = github_session_or_error()
        if error:
            return error

        request.auth_session = session
        return view_func(*args, **kwargs)

    return wrapper
