"""Assinatura/validacao do parametro OAuth 'state', compartilhada pelos tres provedores
(GitHub, Microsoft Entra ID e Atlassian) para protecao contra CSRF no fluxo Authorization Code.

Vive em modulo proprio -- e nao dentro de github_oauth.py, onde estava antes -- porque nao tem
nada de especifico do GitHub: e usada igualmente pelos logins Microsoft e Atlassian. Exige sempre
OAUTH_STATE_SECRET; nao ha fallback para o client secret de nenhum provedor especifico, para que
um login Microsoft/Atlassian nunca dependa de uma variavel de configuracao do GitHub (ou vice-versa).
"""
import base64
import hashlib
import hmac
import json
import os
import secrets
import time


def _get_required_env(name):
    value = (os.environ.get(name) or "").strip()
    if not value:
        raise RuntimeError(f"Variavel {name} nao configurada.")
    return value


def _get_state_secret():
    return _get_required_env("OAUTH_STATE_SECRET")


def _get_state_ttl_ms():
    try:
        value = int(os.environ.get("AUTH_STATE_TTL_MS", "600000"))
    except ValueError:
        value = 600000
    return value if value > 0 else 600000


def _to_base64url(raw_bytes):
    return base64.urlsafe_b64encode(raw_bytes).rstrip(b"=").decode("ascii")


def _from_base64url(value):
    padding = "=" * ((4 - len(value) % 4) % 4)
    return base64.urlsafe_b64decode(value + padding)


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
