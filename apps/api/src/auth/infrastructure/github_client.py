"""Fluxo OAuth do GitHub: troca de code por token e leitura do usuario autenticado.

A assinatura/validacao do parametro 'state' (compartilhada com Microsoft e Atlassian) vive em
oauth_state.py, nao aqui -- veja esse modulo para o motivo.
"""
import os
from urllib.parse import urlencode

import requests

GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
GITHUB_ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_USER_URL = "https://api.github.com/user"


def _get_required_env(name):
    value = (os.environ.get(name) or "").strip()
    if not value:
        raise RuntimeError(f"Variavel {name} nao configurada.")
    return value


def _get_scopes():
    return (os.environ.get("GITHUB_OAUTH_SCOPES") or "read:user user:email").strip()


def _get_redirect_uri():
    return _get_required_env("GITHUB_OAUTH_REDIRECT_URI")


def get_oauth_config():
    client_id = (os.environ.get("GITHUB_OAUTH_CLIENT_ID") or "").strip()
    client_secret = (os.environ.get("GITHUB_OAUTH_CLIENT_SECRET") or "").strip()
    redirect_uri = (os.environ.get("GITHUB_OAUTH_REDIRECT_URI") or "").strip()

    return {
        "configured": bool(client_id and client_secret and redirect_uri),
        "redirectUri": redirect_uri,
        "scopes": _get_scopes(),
    }


def build_github_login_url(state):
    client_id = _get_required_env("GITHUB_OAUTH_CLIENT_ID")
    redirect_uri = _get_redirect_uri()
    scopes = _get_scopes()

    query = urlencode(
        {"client_id": client_id, "redirect_uri": redirect_uri, "scope": scopes, "state": state}
    )
    return f"{GITHUB_AUTHORIZE_URL}?{query}"


def exchange_code_for_token(code, state):
    client_id = _get_required_env("GITHUB_OAUTH_CLIENT_ID")
    client_secret = _get_required_env("GITHUB_OAUTH_CLIENT_SECRET")
    redirect_uri = _get_redirect_uri()

    response = requests.post(
        GITHUB_ACCESS_TOKEN_URL,
        json={
            "client_id": client_id,
            "client_secret": client_secret,
            "code": code,
            "redirect_uri": redirect_uri,
            "state": state,
        },
        headers={
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": "qualiflow-copilot-poc",
        },
        timeout=15,
    )

    payload = response.json()

    if not response.ok or payload.get("error"):
        error_description = payload.get("error_description") or payload.get("error") or response.reason
        raise RuntimeError(f"Falha no OAuth GitHub: {error_description}")

    access_token = (payload.get("access_token") or "").strip()
    if not access_token:
        raise RuntimeError("OAuth GitHub retornou token vazio.")

    return {
        "accessToken": access_token,
        "tokenType": payload.get("token_type", "bearer"),
        "scope": payload.get("scope", ""),
    }


def fetch_github_user(access_token):
    response = requests.get(
        GITHUB_USER_URL,
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {access_token}",
            "User-Agent": "qualiflow-copilot-poc",
        },
        timeout=15,
    )

    payload = response.json()

    if not response.ok:
        message = payload.get("message") or response.reason
        raise RuntimeError(f"Falha ao obter usuario GitHub: {message}")

    return {
        "id": payload.get("id"),
        "login": payload.get("login"),
        "name": payload.get("name"),
        "avatarUrl": payload.get("avatar_url"),
    }
