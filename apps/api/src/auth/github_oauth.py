"""Fluxo OAuth do GitHub: geracao/validacao de state assinado e troca de code por token."""
import base64
import hashlib
import hmac
import json
import os
import secrets
import time
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


def _to_base64url(raw_bytes):
    return base64.urlsafe_b64encode(raw_bytes).rstrip(b"=").decode("ascii")


def _from_base64url(value):
    padding = "=" * ((4 - len(value) % 4) % 4)
    return base64.urlsafe_b64decode(value + padding)


def _get_state_secret():
    configured = (os.environ.get("OAUTH_STATE_SECRET") or "").strip()
    if configured:
        return configured
    return _get_required_env("GITHUB_OAUTH_CLIENT_SECRET")


def _get_state_ttl_ms():
    try:
        value = int(os.environ.get("AUTH_STATE_TTL_MS", "600000"))
    except ValueError:
        value = 600000
    return value if value > 0 else 600000


def create_oauth_state(extra_payload=None):
    now_ms = int(time.time() * 1000)
    payload = {
        "nonce": secrets.token_hex(16),
        "iat": now_ms,
        "exp": now_ms + _get_state_ttl_ms(),
        **(extra_payload or {}),
    }

    payload_encoded = _to_base64url(json.dumps(payload).encode("utf-8"))
    signature = hmac.new(
        _get_state_secret().encode("utf-8"), payload_encoded.encode("ascii"), hashlib.sha256
    ).digest()
    signature_encoded = _to_base64url(signature)

    return f"{payload_encoded}.{signature_encoded}"


def verify_oauth_state(state):
    token = (state or "").strip()
    if not token:
        return False

    parts = token.split(".")
    if len(parts) != 2:
        return False

    payload_encoded, signature_encoded = parts

    try:
        expected_signature = hmac.new(
            _get_state_secret().encode("utf-8"), payload_encoded.encode("ascii"), hashlib.sha256
        ).digest()
        actual_signature = _from_base64url(signature_encoded)

        if not hmac.compare_digest(actual_signature, expected_signature):
            return False

        payload = json.loads(_from_base64url(payload_encoded).decode("utf-8"))
        exp = payload.get("exp")
        if not exp or time.time() * 1000 > exp:
            return None

        return payload
    except Exception:
        return None


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
