"""Composition root do contexto auth: liga os servicos de aplicacao aos clientes de infraestrutura."""
from .application.board_sessions import BoardSessionService
from .application.login_service import OAuthLoginService
from .infrastructure import atlassian_client, github_client, microsoft_client, oauth_state

login_service = OAuthLoginService(
    github=github_client,
    microsoft=microsoft_client,
    atlassian=atlassian_client,
    state_signer=oauth_state,
)

board_session_service = BoardSessionService(
    token_refreshers={
        "microsoft": microsoft_client.refresh_access_token,
        "atlassian": atlassian_client.refresh_access_token,
    }
)
