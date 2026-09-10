"""Rotas de login OAuth para os provedores de board: Microsoft Entra ID (Azure DevOps) e Atlassian (Jira)."""
from flask import Blueprint, jsonify, redirect, request

from .atlassian_oauth import (
    build_atlassian_login_url,
    exchange_code_for_token as exchange_atlassian_code,
    fetch_accessible_resources,
    fetch_atlassian_profile,
    get_atlassian_oauth_config,
    pick_jira_site,
    refresh_access_token as refresh_atlassian_token,
)
from .middleware import require_auth_session, resolve_session_token
from .github_oauth import create_oauth_state, verify_oauth_state
from .microsoft_oauth import (
    build_microsoft_login_url,
    exchange_code_for_token as exchange_microsoft_code,
    fetch_microsoft_profile,
    get_microsoft_oauth_config,
    refresh_access_token as refresh_microsoft_token,
)
from ..core.session_store import (
    cleanup_expired,
    complete_auth_request,
    create_auth_request,
    create_user_session,
    fail_auth_request,
    get_auth_request,
    get_user_session,
    revoke_user_session,
)

board_auth_routes = Blueprint("board_auth_routes", __name__)

BOARD_PROVIDERS = {"microsoft", "atlassian"}


@board_auth_routes.post("/auth/board/session/start")
def start_board_auth_session():
    cleanup_expired()
    body = request.get_json(silent=True) or {}
    provider = (body.get("provider") or "").strip().lower()

    if provider not in BOARD_PROVIDERS:
        return (
            jsonify(
                {"success": False, "error": {"code": "PROVIDER_INVALID", "message": "provider deve ser 'microsoft' ou 'atlassian'."}}
            ),
            400,
        )

    try:
        request_id = create_auth_request()
        login_path = f"/auth/{provider}/login?requestId={request_id}"
        if provider == "atlassian" and body.get("jiraDomain"):
            login_path += f"&jiraDomain={request.get_json(silent=True).get('jiraDomain', '').strip()}"

        return jsonify(
            {
                "success": True,
                "requestId": request_id,
                "loginPath": login_path,
                "pollPath": f"/auth/session/poll/{request_id}",
            }
        )
    except Exception as error:
        return (
            jsonify({"success": False, "error": {"code": "AUTH_REQUEST_START_ERROR", "message": str(error)}}),
            500,
        )


@board_auth_routes.get("/auth/microsoft/login")
def microsoft_login():
    cleanup_expired()
    try:
        request_id = (request.args.get("requestId") or "").strip()
        if request_id and not get_auth_request(request_id):
            return (
                jsonify({"success": False, "error": {"code": "AUTH_REQUEST_INVALID", "message": "Solicitacao invalida ou expirada."}}),
                400,
            )

        state = create_oauth_state({"requestId": request_id, "provider": "microsoft"} if request_id else {"provider": "microsoft"})
        return redirect(build_microsoft_login_url(state))
    except Exception as error:
        return jsonify({"success": False, "error": {"code": "OAUTH_CONFIG_ERROR", "message": str(error)}}), 500


@board_auth_routes.get("/auth/microsoft/callback")
def microsoft_callback():
    cleanup_expired()
    code = (request.args.get("code") or "").strip()
    state = (request.args.get("state") or "").strip()

    if not code or not state:
        return jsonify({"success": False, "error": {"code": "OAUTH_CALLBACK_INVALID", "message": "code/state ausentes."}}), 400

    state_payload = verify_oauth_state(state)
    if not state_payload:
        return jsonify({"success": False, "error": {"code": "OAUTH_STATE_INVALID", "message": "State invalido ou expirado."}}), 400

    request_id = (state_payload.get("requestId") or "").strip() if isinstance(state_payload, dict) else ""

    try:
        token_result = exchange_microsoft_code(code)
        profile = fetch_microsoft_profile(token_result["accessToken"])
        session = create_user_session(
            access_token={
                "provider": "microsoft",
                "accessToken": token_result["accessToken"],
                "refreshToken": token_result.get("refreshToken"),
                "expiresAt": token_result["expiresAt"],
            },
            user=profile,
        )

        if request_id:
            if not complete_auth_request(request_id, session):
                fail_auth_request(request_id, "Falha ao concluir autenticacao Microsoft.")

        return _render_board_login_success("Microsoft / Azure DevOps", profile.get("displayName") or profile.get("emailAddress"))
    except Exception as error:
        if request_id:
            fail_auth_request(request_id, str(error))
        return jsonify({"success": False, "error": {"code": "OAUTH_EXCHANGE_ERROR", "message": str(error)}}), 500


@board_auth_routes.get("/auth/atlassian/login")
def atlassian_login():
    cleanup_expired()
    try:
        request_id = (request.args.get("requestId") or "").strip()
        jira_domain = (request.args.get("jiraDomain") or "").strip()

        if request_id and not get_auth_request(request_id):
            return (
                jsonify({"success": False, "error": {"code": "AUTH_REQUEST_INVALID", "message": "Solicitacao invalida ou expirada."}}),
                400,
            )

        payload = {"provider": "atlassian"}
        if request_id:
            payload["requestId"] = request_id
        if jira_domain:
            payload["jiraDomain"] = jira_domain

        state = create_oauth_state(payload)
        return redirect(build_atlassian_login_url(state))
    except Exception as error:
        return jsonify({"success": False, "error": {"code": "OAUTH_CONFIG_ERROR", "message": str(error)}}), 500


@board_auth_routes.get("/auth/atlassian/callback")
def atlassian_callback():
    cleanup_expired()
    code = (request.args.get("code") or "").strip()
    state = (request.args.get("state") or "").strip()

    if not code or not state:
        return jsonify({"success": False, "error": {"code": "OAUTH_CALLBACK_INVALID", "message": "code/state ausentes."}}), 400

    state_payload = verify_oauth_state(state)
    if not state_payload:
        return jsonify({"success": False, "error": {"code": "OAUTH_STATE_INVALID", "message": "State invalido ou expirado."}}), 400

    request_id = (state_payload.get("requestId") or "").strip() if isinstance(state_payload, dict) else ""
    jira_domain = (state_payload.get("jiraDomain") or "").strip() if isinstance(state_payload, dict) else ""

    try:
        token_result = exchange_atlassian_code(code)
        resources = fetch_accessible_resources(token_result["accessToken"])
        site = pick_jira_site(resources, jira_domain)
        if not site:
            raise RuntimeError("Nenhum site Jira acessivel foi encontrado para esta conta Atlassian.")

        profile = fetch_atlassian_profile(token_result["accessToken"])
        session = create_user_session(
            access_token={
                "provider": "atlassian",
                "accessToken": token_result["accessToken"],
                "refreshToken": token_result.get("refreshToken"),
                "expiresAt": token_result["expiresAt"],
                "cloudId": site.get("id"),
                "siteUrl": site.get("url"),
            },
            user=profile,
        )

        if request_id:
            if not complete_auth_request(request_id, session):
                fail_auth_request(request_id, "Falha ao concluir autenticacao Atlassian.")

        return _render_board_login_success("Atlassian / Jira", profile.get("name") or profile.get("email"))
    except Exception as error:
        if request_id:
            fail_auth_request(request_id, str(error))
        return jsonify({"success": False, "error": {"code": "OAUTH_EXCHANGE_ERROR", "message": str(error)}}), 500


def _render_board_login_success(provider_label, account_label):
    return f"""<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>QualiFlow OAuth</title>
  <style>
    body {{ font-family: sans-serif; margin: 2rem; line-height: 1.4; }}
    .ok {{ color: #0f766e; font-weight: 700; }}
  </style>
</head>
<body>
  <h1 class="ok">Login com {provider_label} concluido</h1>
  <p>Conta: <strong>{account_label or 'desconhecida'}</strong></p>
  <p>Voce pode fechar esta aba e voltar para a extensao.</p>
</body>
</html>""", 200


@board_auth_routes.get("/auth/board/status")
def board_status():
    return jsonify(
        {
            "success": True,
            "microsoft": get_microsoft_oauth_config(),
            "atlassian": get_atlassian_oauth_config(),
        }
    )


@board_auth_routes.get("/auth/board/me")
@require_auth_session
def board_me():
    return jsonify(
        {"success": True, "user": request.auth_session["user"], "provider": (request.auth_session.get("accessToken") or {}).get("provider")}
    )


@board_auth_routes.post("/auth/board/logout")
def board_logout():
    session_token = resolve_session_token(request)
    if not session_token:
        return jsonify({"success": False, "error": {"code": "SESSION_TOKEN_REQUIRED", "message": "Envie Authorization: Bearer <sessionToken>."}}), 400

    revoke_user_session(session_token)
    return jsonify({"success": True})


def get_valid_board_access_token(session_token, expected_provider):
    """Retorna um access token valido (renovando via refresh token se necessario), atualizando a sessao."""
    import time

    session = get_user_session(session_token)
    if not session:
        raise RuntimeError("BOARD_SESSION_INVALID")

    token_data = session.get("accessToken") or {}
    if token_data.get("provider") != expected_provider:
        raise RuntimeError("BOARD_SESSION_WRONG_PROVIDER")

    if token_data.get("expiresAt", 0) > time.time():
        return token_data, session

    refresh_token = token_data.get("refreshToken")
    if not refresh_token:
        raise RuntimeError("BOARD_SESSION_EXPIRED")

    if expected_provider == "microsoft":
        refreshed = refresh_microsoft_token(refresh_token)
    else:
        refreshed = refresh_atlassian_token(refresh_token)

    token_data = {
        **token_data,
        "accessToken": refreshed["accessToken"],
        "refreshToken": refreshed.get("refreshToken") or refresh_token,
        "expiresAt": refreshed["expiresAt"],
    }
    session["accessToken"] = token_data
    return token_data, session
