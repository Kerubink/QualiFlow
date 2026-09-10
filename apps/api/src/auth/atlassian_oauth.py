"""
OAuth 2.0 (3LO) com Atlassian, usado para autenticar no Jira Cloud sem exigir API Token
manual do usuario.

Requer um app OAuth 2.0 (3LO) criado em https://developer.atlassian.com/console/myapps/
com callback apontando para <backend>/auth/atlassian/callback e escopos:
read:jira-work, write:jira-work, read:me, offline_access.
"""
import os
import time

import requests

ATLASSIAN_AUTHORIZE_URL = "https://auth.atlassian.com/authorize"
ATLASSIAN_TOKEN_URL = "https://auth.atlassian.com/oauth/token"
ATLASSIAN_ACCESSIBLE_RESOURCES_URL = "https://api.atlassian.com/oauth/token/accessible-resources"
ATLASSIAN_ME_URL = "https://api.atlassian.com/me"

DEFAULT_SCOPES = "read:jira-work write:jira-work read:me offline_access"


def _get_required_env(name):
    value = (os.environ.get(name) or "").strip()
    if not value:
        raise RuntimeError(f"Variavel {name} nao configurada.")
    return value


def _get_redirect_uri():
    return _get_required_env("ATLASSIAN_REDIRECT_URI")


def _get_scopes():
    return (os.environ.get("ATLASSIAN_SCOPES") or DEFAULT_SCOPES).strip()


def get_atlassian_oauth_config():
    client_id = (os.environ.get("ATLASSIAN_CLIENT_ID") or "").strip()
    client_secret = (os.environ.get("ATLASSIAN_CLIENT_SECRET") or "").strip()
    redirect_uri = (os.environ.get("ATLASSIAN_REDIRECT_URI") or "").strip()

    return {
        "configured": bool(client_id and client_secret and redirect_uri),
        "redirectUri": redirect_uri,
        "scopes": _get_scopes(),
    }


def build_atlassian_login_url(state):
    client_id = _get_required_env("ATLASSIAN_CLIENT_ID")
    redirect_uri = _get_redirect_uri()

    params = {
        "audience": "api.atlassian.com",
        "client_id": client_id,
        "scope": _get_scopes(),
        "redirect_uri": redirect_uri,
        "state": state,
        "response_type": "code",
        "prompt": "consent",
    }
    query = "&".join(f"{key}={requests.utils.quote(str(value), safe='')}" for key, value in params.items())
    return f"{ATLASSIAN_AUTHORIZE_URL}?{query}"


def _token_request(payload):
    response = requests.post(ATLASSIAN_TOKEN_URL, json=payload, headers={"Content-Type": "application/json"}, timeout=15)
    body = response.json()

    if not response.ok or body.get("error"):
        message = body.get("error_description") or body.get("error") or response.reason
        raise RuntimeError(f"Falha no OAuth Atlassian: {message}")

    return {
        "accessToken": body["access_token"],
        "refreshToken": body.get("refresh_token"),
        "expiresAt": time.time() + int(body.get("expires_in", 3600)) - 60,
    }


def exchange_code_for_token(code):
    client_id = _get_required_env("ATLASSIAN_CLIENT_ID")
    client_secret = _get_required_env("ATLASSIAN_CLIENT_SECRET")
    redirect_uri = _get_redirect_uri()

    return _token_request(
        {
            "grant_type": "authorization_code",
            "client_id": client_id,
            "client_secret": client_secret,
            "code": code,
            "redirect_uri": redirect_uri,
        }
    )


def refresh_access_token(refresh_token):
    client_id = _get_required_env("ATLASSIAN_CLIENT_ID")
    client_secret = _get_required_env("ATLASSIAN_CLIENT_SECRET")

    return _token_request(
        {
            "grant_type": "refresh_token",
            "client_id": client_id,
            "client_secret": client_secret,
            "refresh_token": refresh_token,
        }
    )


def fetch_accessible_resources(access_token):
    response = requests.get(
        ATLASSIAN_ACCESSIBLE_RESOURCES_URL,
        headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
        timeout=15,
    )

    if not response.ok:
        raise RuntimeError(f"Falha ao listar sites Atlassian acessiveis: HTTP {response.status_code}")

    return response.json() or []


def fetch_atlassian_profile(access_token):
    response = requests.get(
        ATLASSIAN_ME_URL,
        headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
        timeout=15,
    )

    if not response.ok:
        raise RuntimeError(f"Falha ao obter perfil Atlassian: HTTP {response.status_code}")

    payload = response.json()
    return {
        "accountId": payload.get("account_id"),
        "name": payload.get("name"),
        "email": payload.get("email"),
    }


def pick_jira_site(resources, preferred_domain=None):
    """Escolhe o cloud site correspondente ao dominio configurado (ou o primeiro disponivel)."""
    jira_sites = [r for r in resources if "jira" in (r.get("scopes") or []) or True]

    if preferred_domain:
        normalized = preferred_domain.strip().lower().replace("https://", "").replace("http://", "").rstrip("/")
        for site in jira_sites:
            site_url = str(site.get("url") or "").lower().replace("https://", "").replace("http://", "").rstrip("/")
            if site_url == normalized or normalized in site_url:
                return site

    return jira_sites[0] if jira_sites else None
