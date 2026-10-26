"""Regressao: OAUTH_STATE_SECRET (assinatura do parametro 'state') e compartilhado por GitHub,
Microsoft e Atlassian e NAO pode depender de nenhuma variavel especifica de um provedor --
um login Microsoft/Atlassian, por exemplo, nunca deve exigir GITHUB_OAUTH_CLIENT_SECRET."""
import pytest

from src.auth.infrastructure import oauth_state


def test_create_and_verify_state_without_any_github_env_vars(monkeypatch):
    monkeypatch.delenv("GITHUB_OAUTH_CLIENT_ID", raising=False)
    monkeypatch.delenv("GITHUB_OAUTH_CLIENT_SECRET", raising=False)
    monkeypatch.setenv("OAUTH_STATE_SECRET", "chave-de-teste")

    state = oauth_state.create_oauth_state({"provider": "microsoft"})
    payload = oauth_state.verify_oauth_state(state)

    assert payload["provider"] == "microsoft"


def test_create_state_without_oauth_state_secret_raises_clear_error(monkeypatch):
    monkeypatch.delenv("OAUTH_STATE_SECRET", raising=False)
    monkeypatch.delenv("GITHUB_OAUTH_CLIENT_SECRET", raising=False)

    with pytest.raises(RuntimeError, match="OAUTH_STATE_SECRET"):
        oauth_state.create_oauth_state()


def test_verify_state_rejects_tampered_signature(monkeypatch):
    monkeypatch.setenv("OAUTH_STATE_SECRET", "chave-de-teste")
    state = oauth_state.create_oauth_state({"provider": "atlassian"})

    # Troca um caractere no MEIO da assinatura (nao o ultimo): o ultimo caractere de uma
    # assinatura base64url de 32 bytes (SHA-256) tem bits de padding que nao afetam os bytes
    # decodificados, entao alterar so ele poderia nao mudar a assinatura de fato (teste flaky).
    signature_part = state.split(".")[1]
    mid = len(signature_part) // 2
    flipped_char = "A" if signature_part[mid] != "A" else "B"
    tampered_signature = signature_part[:mid] + flipped_char + signature_part[mid + 1:]
    tampered = state.split(".")[0] + "." + tampered_signature

    assert oauth_state.verify_oauth_state(tampered) is False
