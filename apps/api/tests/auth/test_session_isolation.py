"""Regressao: sessoes GitHub (Copilot) e de board (Microsoft/Atlassian) compartilham o mesmo
session store, mas cada rota deve aceitar apenas o tipo de sessao do seu provedor."""
import pytest

from src.generation.domain.errors import classify_ai_error
from src.shared.session_store import create_user_session
from src.server import app


@pytest.fixture
def client():
    return app.test_client()


@pytest.fixture
def github_session():
    return create_user_session("github-access-fake", {"login": "qa"})


@pytest.fixture
def microsoft_session():
    return create_user_session(
        {"provider": "microsoft", "accessToken": "ms-access-fake", "expiresAt": 9_999_999_999},
        {"displayName": "QA"},
    )


def _auth(session):
    return {"Authorization": f"Bearer {session['sessionToken']}"}


def test_board_route_rejects_github_session_with_401_json(client, github_session):
    response = client.post("/api/board/azure/work-item", json={}, headers=_auth(github_session))

    assert response.status_code == 401
    assert response.get_json()["error"]["code"] == "BOARD_SESSION_WRONG_PROVIDER"


def test_copilot_route_rejects_board_session(client, microsoft_session):
    response = client.get("/api/copilot/models", headers=_auth(microsoft_session))

    assert response.status_code == 401
    assert response.get_json()["error"]["code"] == "AUTH_SESSION_INVALID"


def test_scenarios_generate_with_copilot_rejects_board_session(client, microsoft_session):
    response = client.post(
        "/api/scenarios/generate",
        json={"selectedAi": "copilot", "cardData": {"title": "Card"}},
        headers=_auth(microsoft_session),
    )

    assert response.status_code == 401
    assert response.get_json()["error"]["code"] == "AUTH_SESSION_INVALID"


def test_copilot_route_accepts_github_session(client, github_session):
    response = client.get("/api/copilot/models", headers=_auth(github_session))

    assert response.status_code == 200


def test_board_me_accepts_board_session_and_rejects_github(client, microsoft_session, github_session):
    ok = client.get("/auth/board/me", headers=_auth(microsoft_session))
    rejected = client.get("/auth/board/me", headers=_auth(github_session))

    assert ok.status_code == 200
    assert ok.get_json()["provider"] == "microsoft"
    assert rejected.status_code == 401


def test_board_session_start_escapes_jira_domain(client):
    response = client.post(
        "/auth/board/session/start",
        json={"provider": "atlassian", "jiraDomain": "empresa.atlassian.net&requestId=outro"},
    )

    login_path = response.get_json()["loginPath"]
    assert "jiraDomain=empresa.atlassian.net%26requestId%3Doutro" in login_path
    assert login_path.count("&") == 1


def test_classify_ai_error_exposes_missing_api_key():
    normalized = classify_ai_error("gemini", RuntimeError("API Key do Gemini nao configurada."))

    assert normalized["code"] == "AI_KEY_MISSING"
    assert "Gemini" in normalized["message"]
    assert normalized["httpStatus"] == 400
