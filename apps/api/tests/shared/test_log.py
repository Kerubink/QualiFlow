from src.shared.log import log, log_calls


def test_log_masks_sensitive_fields_and_token_values(capsys):
    log("auth", "teste gho_abcdefghijklmnop1234", accessToken="valor", usuario="ana", code="abc", chave_api="x")
    out = capsys.readouterr().out
    assert "gho_abcdefghijklmnop1234" not in out
    assert "accessToken=<oculto>" in out and "code=<oculto>" in out and "chave_api=<oculto>" in out
    assert "usuario=ana" in out and "[auth]" in out


def test_log_calls_logs_success_and_failure_without_tokens(capsys):
    @log_calls("azure")
    class Service:
        def get_work_item(self, access_token, org_url, project, ids):
            return 1

        def boom(self, access_token, project):
            raise RuntimeError("falhou")

    Service().get_work_item("segredo-token-123", "https://dev.azure.com/org", "Proj", [1, 2])
    try:
        Service().boom("segredo-token-123", "Proj")
    except RuntimeError:
        pass
    out = capsys.readouterr().out
    assert "get_work_item ok" in out and "project=Proj" in out and "ids=2 itens" in out
    assert "boom FALHOU" in out and "falhou" in out
    assert "segredo-token-123" not in out
