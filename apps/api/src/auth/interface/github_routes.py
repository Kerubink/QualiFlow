"""Rotas de autenticacao OAuth GitHub e gerenciamento de sessao."""
from flask import Blueprint, jsonify, redirect, request

from ...shared.interface.responses import error_response
from ...shared.log import log, short_id
from ..application.errors import AuthRequestInvalid
from ..container import login_service
from .middleware import require_auth_session, resolve_session_token

auth_routes = Blueprint("auth_routes", __name__)


@auth_routes.post("/auth/session/start")
def start_auth_session():
    try:
        request_id = login_service.start_request()
        return jsonify(
            {
                "success": True,
                "requestId": request_id,
                "loginPath": f"/auth/github/login?requestId={request_id}",
                "pollPath": f"/auth/session/poll/{request_id}",
            }
        )
    except Exception as error:
        return error_response("AUTH_REQUEST_START_ERROR", str(error), 500)


@auth_routes.get("/auth/session/poll/<request_id>")
def poll_auth_session(request_id):
    request_id = (request_id or "").strip()
    if not request_id:
        return error_response("AUTH_REQUEST_ID_REQUIRED", "requestId nao informado.", 400)

    auth_request = login_service.get_request(request_id)
    if not auth_request:
        return (
            jsonify(
                {
                    "success": False,
                    "status": "expired",
                    "error": {
                        "code": "AUTH_REQUEST_NOT_FOUND",
                        "message": "Solicitacao expirada ou inexistente. Inicie novo login.",
                    },
                }
            ),
            404,
        )

    if auth_request["status"] == "completed":
        session = auth_request["session"]
        log("auth", "extensao recebeu a sessao (login concluido)", usuario=session["user"].get("login"), solicitacao=short_id(request_id))
        return jsonify(
            {
                "success": True,
                "status": "completed",
                "sessionToken": session["sessionToken"],
                "user": session["user"],
                "expiresAt": session["expiresAt"],
            }
        )

    if auth_request["status"] == "error":
        log("auth", "extensao recebeu erro de login", erro=auth_request.get("error"), solicitacao=short_id(request_id))
        return (
            jsonify(
                {
                    "success": False,
                    "status": "error",
                    "error": {
                        "code": "AUTH_REQUEST_ERROR",
                        "message": auth_request.get("error") or "Falha no login OAuth.",
                    },
                }
            ),
            400,
        )

    return jsonify({"success": True, "status": "pending"})


@auth_routes.get("/auth/github/login")
def github_login():
    try:
        request_id = (request.args.get("requestId") or "").strip()
        return redirect(login_service.build_github_login_url(request_id))
    except AuthRequestInvalid:
        return error_response(
            "AUTH_REQUEST_INVALID", "Solicitacao de login invalida ou expirada. Gere uma nova tentativa.", 400
        )
    except Exception as error:
        return error_response("OAUTH_CONFIG_ERROR", str(error), 500)


def _render_session_token_page(session):
    return f"""<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>QualiFlow OAuth</title>
  <style>
    body {{ font-family: sans-serif; margin: 2rem; line-height: 1.4; }}
    code, pre {{ background: #f1f3f5; padding: .25rem .4rem; border-radius: 6px; }}
    pre {{ overflow: auto; padding: 1rem; }}
  </style>
</head>
<body>
  <h1>Login concluido com sucesso</h1>
  <p>Usuario: <strong>{session["user"]["login"]}</strong></p>
  <p>Guarde este session token temporario (memoria local do backend):</p>
  <pre>{session["sessionToken"]}</pre>
  <p>Exemplo de chamada da API:</p>
  <pre>curl -X POST "/api/copilot/test" -H "Authorization: Bearer {session["sessionToken"]}" -H "Content-Type: application/json" -d '{{"prompt":"Validar login"}}'</pre>
</body>
</html>"""


def _render_login_done_page(session):
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
  <h1 class="ok">Login concluido com sucesso</h1>
  <p>Usuario: <strong>{session["user"]["login"]}</strong></p>
  <p>Voce pode fechar esta aba e voltar para a extensao.</p>
</body>
</html>"""


@auth_routes.get("/auth/github/callback")
def github_callback():
    login_service.prepare_callback()

    code = (request.args.get("code") or "").strip()
    state = (request.args.get("state") or "").strip()

    if not code or not state:
        log("auth", "callback do GitHub sem code/state", erro=request.args.get("error_description") or request.args.get("error"))
        return error_response(
            "OAUTH_CALLBACK_INVALID", "Parametros code/state obrigatorios nao informados.", 400
        )

    state_payload = login_service.verify_state(state)
    if not state_payload:
        log("auth", "callback do GitHub com state invalido ou expirado")
        return error_response("OAUTH_STATE_INVALID", "State invalido ou expirado. Tente o login novamente.", 400)

    try:
        session, request_id = login_service.complete_github_login(code, state, state_payload)

        if request_id:
            return _render_login_done_page(session), 200

        return _render_session_token_page(session), 200
    except Exception as error:
        return error_response("OAUTH_EXCHANGE_ERROR", str(error), 500)


@auth_routes.get("/auth/status")
def auth_status():
    return jsonify(
        {"success": True, "oauth": login_service.github_oauth_config(), "sessions": login_service.session_stats()}
    )


@auth_routes.get("/auth/me")
@require_auth_session
def auth_me():
    return jsonify(
        {"success": True, "user": request.auth_session["user"], "expiresAt": request.auth_session["expiresAt"]}
    )


@auth_routes.post("/auth/logout")
def auth_logout():
    session_token = resolve_session_token(request)
    if not session_token:
        return error_response(
            "SESSION_TOKEN_REQUIRED", "Envie Authorization: Bearer <sessionToken> para logout.", 400
        )

    login_service.logout(session_token)
    return jsonify({"success": True})
