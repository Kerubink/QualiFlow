"""Sessoes de board (Microsoft/Atlassian): validacao de provedor e renovacao do access token."""
import time

from ...shared.session_store import get_user_session
from .errors import BoardSessionError


class BoardSessionService:
    def __init__(self, token_refreshers):
        """`token_refreshers`: {provider: callable(refresh_token) -> {accessToken, refreshToken?, expiresAt}}."""
        self._token_refreshers = token_refreshers

    def get_valid_board_access_token(self, session_token, expected_provider):
        """Retorna um access token valido (renovando via refresh token se necessario), atualizando a sessao."""
        session = get_user_session(session_token)
        if not session:
            raise BoardSessionError("BOARD_SESSION_INVALID")

        token_data = session.get("accessToken") or {}
        if not isinstance(token_data, dict) or token_data.get("provider") != expected_provider:
            raise BoardSessionError("BOARD_SESSION_WRONG_PROVIDER")

        if token_data.get("expiresAt", 0) > time.time():
            return token_data, session

        refresh_token = token_data.get("refreshToken")
        if not refresh_token:
            raise BoardSessionError("BOARD_SESSION_EXPIRED")

        refreshed = self._token_refreshers[expected_provider](refresh_token)

        token_data = {
            **token_data,
            "accessToken": refreshed["accessToken"],
            "refreshToken": refreshed.get("refreshToken") or refresh_token,
            "expiresAt": refreshed["expiresAt"],
        }
        session["accessToken"] = token_data
        return token_data, session
