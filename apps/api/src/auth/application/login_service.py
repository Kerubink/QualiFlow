"""Casos de uso de login OAuth (GitHub, Microsoft Entra ID e Atlassian 3LO) e de sessao.

O cliente da extensao inicia o login e faz polling; este servico controla state, callback e sessoes
(armazenadas em memoria em shared.session_store). Os clientes de provedor sao injetados.
"""
from ...shared.log import log, short_id
from ...shared.session_store import (
    cleanup_expired,
    complete_auth_request,
    create_auth_request,
    create_user_session,
    fail_auth_request,
    get_auth_request,
    get_session_store_stats,
    get_user_session,
    revoke_user_session,
)
from ..domain.jira_sites import pick_jira_site
from .errors import AuthRequestInvalid


def _request_id_from(state_payload):
    return (state_payload.get("requestId") or "").strip() if isinstance(state_payload, dict) else ""


class OAuthLoginService:
    def __init__(self, github, microsoft, atlassian, state_signer):
        """`github`/`microsoft`/`atlassian`: clientes de provedor; `state_signer`: create/verify do parametro state."""
        self._github = github
        self._microsoft = microsoft
        self._atlassian = atlassian
        self._state = state_signer

    # --- solicitacoes de login (polling) ---

    def start_request(self):
        cleanup_expired()
        request_id = create_auth_request()
        log("auth", "solicitacao de login criada (aguardando o usuario autorizar)", solicitacao=short_id(request_id))
        return request_id

    def get_request(self, request_id):
        cleanup_expired()
        return get_auth_request(request_id)

    # --- inicio do login (redirect para o provedor) ---

    def _require_known_request(self, request_id):
        if request_id and not get_auth_request(request_id):
            raise AuthRequestInvalid()

    def build_github_login_url(self, request_id):
        cleanup_expired()
        self._require_known_request(request_id)
        state = self._state.create_oauth_state({"requestId": request_id} if request_id else {})
        log("auth", "redirecionando para o login do GitHub", solicitacao=short_id(request_id))
        return self._github.build_github_login_url(state)

    def build_microsoft_login_url(self, request_id):
        cleanup_expired()
        self._require_known_request(request_id)
        state = self._state.create_oauth_state(
            {"requestId": request_id, "provider": "microsoft"} if request_id else {"provider": "microsoft"}
        )
        log("auth", "redirecionando para o login Microsoft (Azure DevOps)", solicitacao=short_id(request_id))
        return self._microsoft.build_microsoft_login_url(state)

    def build_atlassian_login_url(self, request_id, jira_domain):
        cleanup_expired()
        self._require_known_request(request_id)

        payload = {"provider": "atlassian"}
        if request_id:
            payload["requestId"] = request_id
        if jira_domain:
            payload["jiraDomain"] = jira_domain

        log("auth", "redirecionando para o login Atlassian (Jira)", solicitacao=short_id(request_id))
        return self._atlassian.build_atlassian_login_url(self._state.create_oauth_state(payload))

    # --- callback ---

    def prepare_callback(self):
        cleanup_expired()

    def verify_state(self, state):
        """Retorna o payload do state, ou um valor falsy se invalido/expirado."""
        return self._state.verify_oauth_state(state)

    def complete_github_login(self, code, state, state_payload):
        """Troca o code por token, cria a sessao e conclui a solicitacao. Retorna (session, request_id)."""
        request_id = _request_id_from(state_payload)
        try:
            token_result = self._github.exchange_code_for_token(code, state)
            user = self._github.fetch_github_user(token_result["accessToken"])
            session = create_user_session(
                access_token=token_result["accessToken"],
                user={**user, "scope": token_result["scope"]},
            )

            if request_id:
                if not complete_auth_request(request_id, session):
                    fail_auth_request(request_id, "Falha ao concluir autenticacao da solicitacao.")

            log(
                "auth",
                "login GitHub concluido",
                usuario=user.get("login"),
                escopos=token_result.get("scope"),
                solicitacao=short_id(request_id),
            )
            return session, request_id
        except Exception as error:
            log("auth", "login GitHub FALHOU", erro=f"{type(error).__name__}: {error}", solicitacao=short_id(request_id))
            if request_id:
                fail_auth_request(request_id, str(error))
            raise

    def complete_microsoft_login(self, code, state_payload):
        """Retorna (session, profile)."""
        request_id = _request_id_from(state_payload)
        try:
            token_result = self._microsoft.exchange_code_for_token(code)
            profile = self._microsoft.fetch_microsoft_profile(token_result["accessToken"])
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

            log("auth", "login Microsoft (Azure DevOps) concluido", usuario=profile.get("displayName"), solicitacao=short_id(request_id))
            return session, profile
        except Exception as error:
            log("auth", "login Microsoft FALHOU", erro=f"{type(error).__name__}: {error}", solicitacao=short_id(request_id))
            if request_id:
                fail_auth_request(request_id, str(error))
            raise

    def complete_atlassian_login(self, code, state_payload):
        """Retorna (session, profile)."""
        request_id = _request_id_from(state_payload)
        jira_domain = (state_payload.get("jiraDomain") or "").strip() if isinstance(state_payload, dict) else ""
        try:
            token_result = self._atlassian.exchange_code_for_token(code)
            resources = self._atlassian.fetch_accessible_resources(token_result["accessToken"])
            site = pick_jira_site(resources, jira_domain)
            if not site:
                raise RuntimeError("Nenhum site Jira acessivel foi encontrado para esta conta Atlassian.")

            profile = self._atlassian.fetch_atlassian_profile(token_result["accessToken"])
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

            log("auth", "login Atlassian (Jira) concluido", usuario=profile.get("name"), site=site.get("url"), solicitacao=short_id(request_id))
            return session, profile
        except Exception as error:
            log("auth", "login Atlassian FALHOU", erro=f"{type(error).__name__}: {error}", solicitacao=short_id(request_id))
            if request_id:
                fail_auth_request(request_id, str(error))
            raise

    # --- status e sessao ---

    def github_oauth_config(self):
        return self._github.get_oauth_config()

    def board_oauth_configs(self):
        return {
            "microsoft": self._microsoft.get_microsoft_oauth_config(),
            "atlassian": self._atlassian.get_atlassian_oauth_config(),
        }

    def session_stats(self):
        return get_session_store_stats()

    def get_session(self, session_token):
        return get_user_session(session_token)

    def logout(self, session_token):
        session = get_user_session(session_token)
        revoke_user_session(session_token)
        log("auth", "logout", usuario=((session or {}).get("user") or {}).get("login"))
