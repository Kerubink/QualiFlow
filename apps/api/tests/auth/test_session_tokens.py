"""Testes offline das regras de sessao (auth/domain) e da renovacao de token de board (auth/application)."""
import time

import pytest

from src.auth.application.board_sessions import BoardSessionService
from src.auth.application.errors import BoardSessionError
from src.auth.domain.jira_sites import pick_jira_site
from src.auth.domain.session_tokens import (
    board_provider_of,
    extract_bearer_token,
    is_github_session,
    resolve_session_token_from_headers,
)
from src.shared.session_store import create_user_session


def test_extract_bearer_token_requires_scheme_and_single_token():
    assert extract_bearer_token("Bearer abc") == "abc"
    assert extract_bearer_token("bearer abc") == "abc"
    assert extract_bearer_token("Basic abc") == ""
    assert extract_bearer_token("Bearer a b") == ""
    assert extract_bearer_token(None) == ""


def test_resolve_session_token_prefers_authorization_then_custom_header():
    assert resolve_session_token_from_headers({"Authorization": "Bearer abc", "X-Session-Token": "zzz"}) == "abc"
    assert resolve_session_token_from_headers({"X-Session-Token": " zzz "}) == "zzz"
    assert resolve_session_token_from_headers({}) == ""


def test_session_type_helpers_distinguish_github_and_board_sessions():
    github = {"accessToken": "gho_fake"}
    board = {"accessToken": {"provider": "atlassian", "accessToken": "x"}}

    assert is_github_session(github) and not is_github_session(board)
    assert board_provider_of(board) == "atlassian"
    assert board_provider_of(github) is None
    assert board_provider_of(None) is None


def test_pick_jira_site_prefers_matching_domain_else_first():
    resources = [{"id": "1", "url": "https://a.atlassian.net"}, {"id": "2", "url": "https://b.atlassian.net"}]

    assert pick_jira_site(resources, "https://b.atlassian.net/")["id"] == "2"
    assert pick_jira_site(resources, "nao-existe")["id"] == "1"
    assert pick_jira_site([], None) is None


def _board_session(expires_at, refresh_token="refresh-fake"):
    return create_user_session(
        {"provider": "microsoft", "accessToken": "old-access", "refreshToken": refresh_token, "expiresAt": expires_at},
        {"displayName": "QA"},
    )


def test_board_session_service_returns_valid_token_without_refresh():
    service = BoardSessionService({"microsoft": lambda token: pytest.fail("nao deveria renovar")})
    session = _board_session(time.time() + 3600)

    token_data, _ = service.get_valid_board_access_token(session["sessionToken"], "microsoft")

    assert token_data["accessToken"] == "old-access"


def test_board_session_service_refreshes_expired_token_and_updates_session():
    service = BoardSessionService(
        {"microsoft": lambda token: {"accessToken": "new-access", "refreshToken": None, "expiresAt": time.time() + 3600}}
    )
    session = _board_session(time.time() - 10)

    token_data, stored = service.get_valid_board_access_token(session["sessionToken"], "microsoft")

    assert token_data["accessToken"] == "new-access"
    assert token_data["refreshToken"] == "refresh-fake"
    assert stored["accessToken"]["accessToken"] == "new-access"


@pytest.mark.parametrize(
    "expires_at, refresh_token, provider, expected_code",
    [
        (time.time() + 3600, "r", "atlassian", "BOARD_SESSION_WRONG_PROVIDER"),
        (time.time() - 10, None, "microsoft", "BOARD_SESSION_EXPIRED"),
    ],
)
def test_board_session_service_error_codes(expires_at, refresh_token, provider, expected_code):
    service = BoardSessionService({})
    session = _board_session(expires_at, refresh_token)

    with pytest.raises(BoardSessionError, match=expected_code):
        service.get_valid_board_access_token(session["sessionToken"], provider)


def test_board_session_service_unknown_token_is_invalid():
    with pytest.raises(BoardSessionError, match="BOARD_SESSION_INVALID"):
        BoardSessionService({}).get_valid_board_access_token("token-inexistente", "microsoft")
