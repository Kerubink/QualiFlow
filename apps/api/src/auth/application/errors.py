"""Erros de dominio do fluxo de login, mapeados para respostas HTTP pela camada de interface."""


class AuthRequestInvalid(Exception):
    """requestId informado nao existe ou expirou."""


class BoardSessionError(RuntimeError):
    """Sessao de board invalida. `str(error)` e o codigo (BOARD_SESSION_INVALID, ...WRONG_PROVIDER, ...EXPIRED)."""
