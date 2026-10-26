"""Helpers compartilhados pelas rotas de board: sessao OAuth do provedor e erro padrao de board."""
from flask import request

from ...auth.container import board_session_service
from ...shared.interface.responses import error_response
from ..infrastructure.azure.http import PersonalAccessToken


def require_board_session(provider):
    """Retorna (token_data, error_response). Se error_response nao for None, retorne-o direto.

    Para o Azure DevOps, o header X-Azure-Pat (PAT do usuario) substitui a sessao OAuth. O PAT
    so vive na requisicao: nao e guardado nem logado pelo backend."""
    if provider == "microsoft":
        pat = (request.headers.get("X-Azure-Pat") or "").strip()
        if pat:
            return {"accessToken": PersonalAccessToken(pat)}, None

    session_token = request.headers.get("Authorization", "")
    if session_token.lower().startswith("bearer "):
        session_token = session_token[7:].strip()
    else:
        session_token = (request.headers.get("X-Session-Token") or "").strip()

    if not session_token:
        return None, error_response("AUTH_REQUIRED", "Sessao de board ausente.", 401)

    try:
        token_data, _session = board_session_service.get_valid_board_access_token(session_token, provider)
        return token_data, None
    except RuntimeError as error:
        code = str(error)
        message = {
            "BOARD_SESSION_INVALID": "Sessao invalida ou expirada. Faca login novamente.",
            "BOARD_SESSION_WRONG_PROVIDER": "Sessao pertence a outro provedor.",
            "BOARD_SESSION_EXPIRED": "Sessao expirada e sem refresh token. Faca login novamente.",
        }.get(code, code)
        return None, error_response(code, message, 401)


def board_error_response(error):
    return error_response("BOARD_REQUEST_ERROR", str(error), 502)
