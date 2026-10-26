from src.generation.domain.scenarios import normalize_scenario, normalize_steps, normalize_title, strip_step_prefix


def test_strip_step_prefix_remove_palavras_chave_encadeadas():
    assert strip_step_prefix("E ENTAO o saldo e exibido") == "o saldo e exibido"
    assert strip_step_prefix("ENTAO ENTÃO valida") == "valida"


def test_strip_step_prefix_preserva_palavras_que_comecam_com_e_ou_dado():
    assert strip_step_prefix("Exibe mensagem") == "Exibe mensagem"
    assert strip_step_prefix("Dados validos informados") == "Dados validos informados"
    assert strip_step_prefix("E-mail valido") == "E-mail valido"


def test_normalize_steps_nunca_gera_palavras_chave_duplicadas():
    raw = [{"action": f"E ENTAO passo {i}", "expected": "ok"} for i in range(6)]
    for step in normalize_steps(raw):
        words = step["action"].split()
        assert words[0] in {"DADO", "E", "QUANDO", "ENTAO"}
        assert words[1] not in {"DADO", "E", "QUANDO", "ENTAO"}


def test_normalize_title_usa_prefixo_sem_colchetes():
    assert normalize_title("Login - valido", 0) == "FUNC - Login - valido"
    assert normalize_title("[ui] - Tela", 0) == "UI - Tela"
    assert normalize_title("perf - Tela", 0) == "PERF - Tela"
    assert normalize_title("PERF: Tela", 0) == "PERF - Tela"
    assert normalize_title("[PREFIXO] - Tela", 0, "SEG") == "SEG - Tela"
    assert normalize_title("[UI] [FUNC] - Tela", 0) == "UI - Tela"
    assert normalize_title("UI - FUNC - Tela", 0) == "UI - Tela"
    assert normalize_title("", 2) == "FUNC - CT 3"


def test_normalize_title_nao_consome_palavra_que_nao_e_prefixo():
    assert normalize_title("Cadastro - ok", 0) == "FUNC - Cadastro - ok"


def test_normalize_scenario_aplica_titulo_e_bdd_consistentes():
    result = normalize_scenario({"title": "Cadastro", "steps": [{"action": "ENTAO ENTAO x", "expected": "y"}]}, 0)
    assert result["title"] == "FUNC - Cadastro"
    assert "ENTAO ENTAO" not in result["bdd_description"]
