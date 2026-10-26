"""Rotas de login OAuth para os provedores de board: Microsoft Entra ID (Azure DevOps) e Atlassian (Jira)."""
from urllib.parse import quote

from flask import Blueprint, jsonify, redirect, request

from ...shared.interface.responses import error_response
from ..application.errors import AuthRequestInvalid
from ..container import login_service
from ..domain.session_tokens import BOARD_PROVIDERS, board_provider_of
from .middleware import resolve_session_token

board_auth_routes = Blueprint("board_auth_routes", __name__)


@board_auth_routes.post("/auth/board/session/start")
def start_board_auth_session():
    body = request.get_json(silent=True) or {}
    provider = (body.get("provider") or "").strip().lower()

    if provider not in BOARD_PROVIDERS:
        return error_response("PROVIDER_INVALID", "provider deve ser 'microsoft' ou 'atlassian'.", 400)

    try:
        request_id = login_service.start_request()
        login_path = f"/auth/{provider}/login?requestId={request_id}"
        jira_domain = str(body.get("jiraDomain") or "").strip()
        if provider == "atlassian" and jira_domain:
            login_path += f"&jiraDomain={quote(jira_domain, safe='')}"

        return jsonify(
            {
                "success": True,
                "requestId": request_id,
                "loginPath": login_path,
                "pollPath": f"/auth/session/poll/{request_id}",
            }
        )
    except Exception as error:
        return error_response("AUTH_REQUEST_START_ERROR", str(error), 500)


@board_auth_routes.get("/auth/microsoft/login")
def microsoft_login():
    try:
        request_id = (request.args.get("requestId") or "").strip()
        return redirect(login_service.build_microsoft_login_url(request_id))
    except AuthRequestInvalid:
        return error_response("AUTH_REQUEST_INVALID", "Solicitacao invalida ou expirada.", 400)
    except Exception as error:
        return error_response("OAUTH_CONFIG_ERROR", str(error), 500)


@board_auth_routes.get("/auth/microsoft/callback")
def microsoft_callback():
    login_service.prepare_callback()
    code = (request.args.get("code") or "").strip()
    state = (request.args.get("state") or "").strip()

    if not code or not state:
        return error_response("OAUTH_CALLBACK_INVALID", "code/state ausentes.", 400)

    state_payload = login_service.verify_state(state)
    if not state_payload:
        return error_response("OAUTH_STATE_INVALID", "State invalido ou expirado.", 400)

    try:
        _session, profile = login_service.complete_microsoft_login(code, state_payload)
        return _render_board_login_success("Microsoft / Azure DevOps", profile.get("displayName") or profile.get("emailAddress"))
    except Exception as error:
        return error_response("OAUTH_EXCHANGE_ERROR", str(error), 500)


@board_auth_routes.get("/auth/atlassian/login")
def atlassian_login():
    try:
        request_id = (request.args.get("requestId") or "").strip()
        jira_domain = (request.args.get("jiraDomain") or "").strip()
        return redirect(login_service.build_atlassian_login_url(request_id, jira_domain))
    except AuthRequestInvalid:
        return error_response("AUTH_REQUEST_INVALID", "Solicitacao invalida ou expirada.", 400)
    except Exception as error:
        return error_response("OAUTH_CONFIG_ERROR", str(error), 500)


@board_auth_routes.get("/auth/atlassian/callback")
def atlassian_callback():
    login_service.prepare_callback()
    code = (request.args.get("code") or "").strip()
    state = (request.args.get("state") or "").strip()

    if not code or not state:
        return error_response("OAUTH_CALLBACK_INVALID", "code/state ausentes.", 400)

    state_payload = login_service.verify_state(state)
    if not state_payload:
        return error_response("OAUTH_STATE_INVALID", "State invalido ou expirado.", 400)

    try:
        _session, profile = login_service.complete_atlassian_login(code, state_payload)
        return _render_board_login_success("Atlassian / Jira", profile.get("name") or profile.get("email"))
    except Exception as error:
        return error_response("OAUTH_EXCHANGE_ERROR", str(error), 500)


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
    return jsonify({"success": True, **login_service.board_oauth_configs()})


@board_auth_routes.get("/auth/board/me")
def board_me():
    session = login_service.get_session(resolve_session_token(request))
    provider = board_provider_of(session)
    if not session or not provider:
        return error_response("BOARD_SESSION_INVALID", "Sessao invalida ou expirada. Faca login novamente.", 401)

    return jsonify({"success": True, "user": session["user"], "provider": provider})


@board_auth_routes.post("/auth/board/logout")
def board_logout():
    session_token = resolve_session_token(request)
    if not session_token:
        return error_response("SESSION_TOKEN_REQUIRED", "Envie Authorization: Bearer <sessionToken>.", 400)

    login_service.logout(session_token)
    return jsonify({"success": True})
