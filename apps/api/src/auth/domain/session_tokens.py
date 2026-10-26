"""Regras puras sobre tokens/sessoes de login: extracao do Bearer token e tipo de sessao.

Sessoes GitHub (Copilot) guardam o access token como string; sessoes de board (Microsoft/Atlassian)
guardam um dict com "provider". Cada rota deve aceitar apenas o tipo de sessao do seu provedor.
"""

BOARD_PROVIDERS = {"microsoft", "atlassian"}


def extract_bearer_token(authorization_header):
    if not authorization_header:
        return ""

    parts = authorization_header.split(" ")
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return ""

    return parts[1].strip()


def resolve_session_token_from_headers(headers):
    """`headers` e qualquer mapeamento com .get (ex.: request.headers do Flask)."""
    header_token = extract_bearer_token(headers.get("Authorization"))
    if header_token:
        return header_token

    return (headers.get("X-Session-Token") or "").strip()


def is_github_session(session):
    """Evita usar um token de board como token do Copilot."""
    return isinstance((session or {}).get("accessToken"), str)


def board_provider_of(session):
    """Retorna o provedor ("microsoft"/"atlassian") se for uma sessao de board valida, senao None."""
    token_data = (session or {}).get("accessToken")
    if isinstance(token_data, dict) and token_data.get("provider") in BOARD_PROVIDERS:
        return token_data.get("provider")
    return None
