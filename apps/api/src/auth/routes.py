"""Rotas de autenticacao OAuth GitHub e gerenciamento de sessao."""
from flask import Blueprint, jsonify, redirect, request

from .middleware import require_auth_session, resolve_session_token
from .github_oauth import (
    build_github_login_url,
    create_oauth_state,
    exchange_code_for_token,
    fetch_github_user,
    get_oauth_config,
    verify_oauth_state,
)
from ..core.session_store import (
    cleanup_expired,
    complete_auth_request,
    create_auth_request,
    create_user_session,
    fail_auth_request,
    get_auth_request,
    get_session_store_stats,
    revoke_user_session,
)

auth_routes = Blueprint("auth_routes", __name__)


@auth_routes.post("/auth/session/start")
def start_auth_session():
    cleanup_expired()

    try:
        request_id = create_auth_request()
        return jsonify(
            {
                "success": True,
                "requestId": request_id,
                "loginPath": f"/auth/github/login?requestId={request_id}",
                "pollPath": f"/auth/session/poll/{request_id}",
            }
        )
    except Exception as error:
        return (
            jsonify(
                {"success": False, "error": {"code": "AUTH_REQUEST_START_ERROR", "message": str(error)}}
            ),
            500,
        )


@auth_routes.get("/auth/session/poll/<request_id>")
def poll_auth_session(request_id):
    cleanup_expired()

    request_id = (request_id or "").strip()
    if not request_id:
        return (
            jsonify(
                {
                    "success": False,
                    "error": {"code": "AUTH_REQUEST_ID_REQUIRED", "message": "requestId nao informado."},
                }
            ),
            400,
        )

    auth_request = get_auth_request(request_id)
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
    cleanup_expired()

    try:
        request_id = (request.args.get("requestId") or "").strip()

        if request_id and not get_auth_request(request_id):
            return (
                jsonify(
                    {
                        "success": False,
                        "error": {
                            "code": "AUTH_REQUEST_INVALID",
                            "message": "Solicitacao de login invalida ou expirada. Gere uma nova tentativa.",
                        },
                    }
                ),
                400,
            )

        state = create_oauth_state({"requestId": request_id} if request_id else {})
        login_url = build_github_login_url(state)
        return redirect(login_url)
    except Exception as error:
        return (
            jsonify({"success": False, "error": {"code": "OAUTH_CONFIG_ERROR", "message": str(error)}}),
            500,
        )


@auth_routes.get("/auth/github/callback")
def github_callback():
    cleanup_expired()

    code = (request.args.get("code") or "").strip()
    state = (request.args.get("state") or "").strip()

    if not code or not state:
        return (
            jsonify(
                {
                    "success": False,
                    "error": {
                        "code": "OAUTH_CALLBACK_INVALID",
                        "message": "Parametros code/state obrigatorios nao informados.",
                    },
                }
            ),
            400,
        )

    state_payload = verify_oauth_state(state)
    if not state_payload:
        return (
            jsonify(
                {
                    "success": False,
                    "error": {
                        "code": "OAUTH_STATE_INVALID",
                        "message": "State invalido ou expirado. Tente o login novamente.",
                    },
                }
            ),
            400,
        )

    try:
        token_result = exchange_code_for_token(code, state)
        user = fetch_github_user(token_result["accessToken"])
        session = create_user_session(
            access_token=token_result["accessToken"],
            user={**user, "scope": token_result["scope"]},
        )

        request_id = (state_payload.get("requestId") or "").strip() if isinstance(state_payload, dict) else ""
        if request_id:
            completed = complete_auth_request(request_id, session)
            if not completed:
                fail_auth_request(request_id, "Falha ao concluir autenticacao da solicitacao.")

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
</html>""", 200

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
</html>""", 200
    except Exception as error:
        request_id = ""
        if isinstance(state_payload, dict):
            request_id = (state_payload.get("requestId") or "").strip()
        if request_id:
            fail_auth_request(request_id, str(error))

        return (
            jsonify({"success": False, "error": {"code": "OAUTH_EXCHANGE_ERROR", "message": str(error)}}),
            500,
        )


@auth_routes.get("/auth/status")
def auth_status():
    return jsonify({"success": True, "oauth": get_oauth_config(), "sessions": get_session_store_stats()})


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
        return (
            jsonify(
                {
                    "success": False,
                    "error": {
                        "code": "SESSION_TOKEN_REQUIRED",
                        "message": "Envie Authorization: Bearer <sessionToken> para logout.",
                    },
                }
            ),
            400,
        )

    revoke_user_session(session_token)
    return jsonify({"success": True})
