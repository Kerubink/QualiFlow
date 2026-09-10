"""
OAuth 2.0 (Authorization Code) com Microsoft Entra ID, usado para autenticar no Azure DevOps
sem exigir Personal Access Token (PAT) do usuario.

Requer um App Registration no Azure Portal (Entra ID) com:
- Redirect URI (web) apontando para <backend>/auth/microsoft/callback
- Delegated permission: "user_impersonation" da API "Azure DevOps"
  (App ID conhecido: 499b84ac-1321-427f-aa17-267ca6975798)
- "Allow public client flows" NAO precisa estar habilitado (usamos client secret).
"""
import os
import time

import requests

AZURE_DEVOPS_RESOURCE_APP_ID = "499b84ac-1321-427f-aa17-267ca6975798"
MS_PROFILE_URL = "https://app.vssps.visualstudio.com/_apis/profile/profiles/me?api-version=7.1"


def _get_required_env(name):
    value = (os.environ.get(name) or "").strip()
    if not value:
        raise RuntimeError(f"Variavel {name} nao configurada.")
    return value


def _get_tenant():
    return (os.environ.get("AZURE_AD_TENANT_ID") or "organizations").strip()


def _get_redirect_uri():
    return _get_required_env("AZURE_AD_REDIRECT_URI")


def _get_scope():
    return f"{AZURE_DEVOPS_RESOURCE_APP_ID}/user_impersonation offline_access"


def get_microsoft_oauth_config():
    client_id = (os.environ.get("AZURE_AD_CLIENT_ID") or "").strip()
    client_secret = (os.environ.get("AZURE_AD_CLIENT_SECRET") or "").strip()
    redirect_uri = (os.environ.get("AZURE_AD_REDIRECT_URI") or "").strip()

    return {
        "configured": bool(client_id and client_secret and redirect_uri),
        "redirectUri": redirect_uri,
        "tenant": _get_tenant(),
    }


def build_microsoft_login_url(state):
    client_id = _get_required_env("AZURE_AD_CLIENT_ID")
    tenant = _get_tenant()
    redirect_uri = _get_redirect_uri()

    params = {
        "client_id": client_id,
        "response_type": "code",
        "redirect_uri": redirect_uri,
        "response_mode": "query",
        "scope": _get_scope(),
        "state": state,
    }
    query = "&".join(f"{key}={requests.utils.quote(str(value), safe='')}" for key, value in params.items())
    return f"https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize?{query}"


def _token_request(data):
    tenant = _get_tenant()
    response = requests.post(
        f"https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token",
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=15,
    )
    payload = response.json()

    if not response.ok or payload.get("error"):
        message = payload.get("error_description") or payload.get("error") or response.reason
        raise RuntimeError(f"Falha no OAuth Microsoft: {message}")

    return {
        "accessToken": payload["access_token"],
        "refreshToken": payload.get("refresh_token"),
        "expiresAt": time.time() + int(payload.get("expires_in", 3600)) - 60,
    }


def exchange_code_for_token(code):
    client_id = _get_required_env("AZURE_AD_CLIENT_ID")
    client_secret = _get_required_env("AZURE_AD_CLIENT_SECRET")
    redirect_uri = _get_redirect_uri()

    return _token_request(
        {
            "client_id": client_id,
            "client_secret": client_secret,
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri,
            "scope": _get_scope(),
        }
    )


def refresh_access_token(refresh_token):
    client_id = _get_required_env("AZURE_AD_CLIENT_ID")
    client_secret = _get_required_env("AZURE_AD_CLIENT_SECRET")

    return _token_request(
        {
            "client_id": client_id,
            "client_secret": client_secret,
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "scope": _get_scope(),
        }
    )


def fetch_microsoft_profile(access_token):
    response = requests.get(
        MS_PROFILE_URL,
        headers={"Authorization": f"Bearer {access_token}", "Accept": "application/json"},
        timeout=15,
    )

    if not response.ok:
        raise RuntimeError(f"Falha ao obter perfil do Azure DevOps: HTTP {response.status_code}")

    payload = response.json()
    return {
        "id": payload.get("id"),
        "displayName": payload.get("displayName"),
        "emailAddress": payload.get("emailAddress") or payload.get("coreAttributes", {}).get("EmailAddress", {}).get("value"),
    }
