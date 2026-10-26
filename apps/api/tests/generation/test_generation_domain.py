"""Testes unitarios offline das regras puras de src/generation/domain (sem Flask, rede ou I/O)."""
from src.generation.domain.ai_providers import normalize_selected_ai
from src.generation.domain.criteria import parse_acceptance_criteria, strip_html
from src.generation.domain.errors import classify_ai_error, classify_copilot_error
from src.generation.domain.planning import fallback_test_plan, resolve_chunk_size, split_in_chunks
from src.generation.domain.post_processing import post_process_generated_scenarios
from src.generation.domain.rtm import compute_rtm, select_coverage
from src.generation.domain.scenarios import build_bdd_description, normalize_steps


def test_strip_html_converts_lists_and_entities():
    assert strip_html("<ul><li>Um &amp; dois</li><li>Tres</li></ul>") == "- Um & dois\n- Tres"


def test_parse_acceptance_criteria_handles_numbered_bullets_dedup_and_short_lines():
    html = "1. Deve pedir o codigo\n- Deve validar o codigo informado\n- Deve validar o codigo informado\ncurto"

    assert parse_acceptance_criteria(html) == ["Deve pedir o codigo", "Deve validar o codigo informado"]


def test_resolve_chunk_size_clamps_and_defaults():
    assert resolve_chunk_size("2") == 2
    assert resolve_chunk_size(99) == 5
    assert resolve_chunk_size(0) == 1
    assert resolve_chunk_size(None) == 3
    assert resolve_chunk_size("abc") == 3


def test_split_in_chunks_and_fallback_plan_limit():
    assert split_in_chunks([1, 2, 3, 4, 5], 2) == [[1, 2], [3, 4], [5]]

    plan = fallback_test_plan([f"criterio {i}" for i in range(12)], {"type": "Security"})
    assert len(plan) == 8
    assert plan[0]["id"] == "CT01"
    assert plan[0]["prefix"] == "SEG"


def test_normalize_steps_enforces_bdd_prefixes_and_bounds():
    steps = normalize_steps([{"action": "abre a tela", "expected": "ok"}])

    assert 6 <= len(steps) <= 10
    assert steps[0]["action"].startswith("DADO ")
    assert sum(1 for step in steps if step["action"].startswith("QUANDO ")) == 1
    assert sum(1 for step in steps if step["action"].startswith("ENTAO ")) == 1


def test_normalize_steps_without_input_uses_default_steps():
    steps = normalize_steps(None)

    assert len(steps) == 6
    assert steps[2]["action"].startswith("QUANDO ")


def test_build_bdd_description_uses_up_to_six_steps():
    steps = normalize_steps([])
    lines = build_bdd_description(steps).split("\n")

    assert len(lines) == 6
    assert lines[0].startswith("DADO ")


def test_compute_rtm_marks_covered_and_missing_criteria():
    scenarios = [{"title": "Validar codigo de autenticacao", "steps": [], "bdd_description": ""}]
    rtm = compute_rtm(["Validar codigo de autenticacao", "Exportar relatorio mensal"], scenarios)

    assert rtm[0]["status"] == "TOTAL"
    assert rtm[0]["covered_by_scenarios"] == ["Validar codigo de autenticacao"]
    assert rtm[1]["status"] == "FALTA"


def test_select_coverage_prefers_well_formed_ai_matrix_else_fallback():
    ai_coverage = {"rtm_matrix": [], "insights": "ia", "coverage_score": "10%"}
    assert select_coverage(ai_coverage, ["c"], []) is ai_coverage

    fallback = select_coverage({"rtm_matrix": "invalido"}, ["c"], [{"title": "CT"}])
    assert fallback["rtm_matrix"][0]["status"] == "TOTAL"
    assert fallback["coverage_score"] == "100%"


def test_post_process_normalizes_cases_defaults_params_and_recomputes_rtm():
    raw = {"test_cases": [{"title": "Validar codigo de autenticacao", "steps": [{"action": "informa @codigo"}]}]}
    result = post_process_generated_scenarios(raw, {"acceptance_criteria": "1. Validar codigo de autenticacao"})

    case = result["test_cases"][0]
    assert case["parameters"] == {"@codigo": "###"}
    assert len(case["steps"]) >= 6
    assert result["total_tests"] == 1
    assert result["coverage_analysis"]["coverage_score"] == "100%"


def test_post_process_accepts_bare_list_and_invalid_payload():
    assert post_process_generated_scenarios([{"title": "CT"}], {})["total_tests"] == 1
    assert post_process_generated_scenarios("lixo", {})["total_tests"] == 0


def test_classify_copilot_error_maps_known_codes():
    assert classify_copilot_error(RuntimeError("invalid_json_response: campo 'x'"))["code"] == "COPILOT_INVALID_JSON_RESPONSE"
    assert classify_copilot_error(RuntimeError("Tempo esgotado: timeout"))["code"] == "COPILOT_TIMEOUT"
    assert classify_copilot_error(RuntimeError("HTTP 401: nope"))["code"] == "COPILOT_AUTH_ERROR"
    assert classify_copilot_error(RuntimeError("boom"))["code"] == "COPILOT_REQUEST_ERROR"


def test_classify_ai_error_relabels_generic_error_for_non_copilot_providers():
    assert classify_ai_error("groq", RuntimeError("boom"))["code"] == "AI_REQUEST_ERROR"
    assert classify_ai_error("copilot", RuntimeError("boom"))["code"] == "COPILOT_REQUEST_ERROR"


def test_normalize_selected_ai_defaults_to_gemini():
    assert normalize_selected_ai(" Groq ") == "groq"
    assert normalize_selected_ai("copilot") == "copilot"
    assert normalize_selected_ai("outro") == "gemini"
    assert normalize_selected_ai(None) == "gemini"
