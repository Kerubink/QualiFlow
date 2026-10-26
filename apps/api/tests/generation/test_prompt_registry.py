"""Testes "golden" do sistema de prompts (prompts/ + prompt_registry.py).

Nao chamam o Copilot de verdade: renderizam os templates e validam schemas localmente.
Objetivo e pegar quebra acidental de prompt/schema em PR review, sem depender de rede.
"""
import jsonschema
import pytest

from src.generation.application.copilot_service import CopilotService
from src.generation.infrastructure import prompt_registry
from src.generation.infrastructure.prompts import PromptCatalog

prompts = PromptCatalog()

SCHEMA_NAMES = ["qa_test_case.schema.json", "qa_test_debug.schema.json", "resumo_executivo.schema.json"]


@pytest.mark.parametrize("schema_name", SCHEMA_NAMES)
def test_schema_examples_validate_against_their_own_schema(schema_name):
    """O 'examples[0]' de cada schema (usado para ilustrar o prompt) tem que ser aceito pelo
    proprio schema (usado para validar a resposta do modelo) -- senao o prompt estaria
    ensinando um formato que a validacao depois rejeitaria."""
    example = prompt_registry.schema_example(schema_name)
    jsonschema.validate(instance=example, schema=prompt_registry.load_schema(schema_name))


def test_validate_against_schema_accepts_valid_payload():
    example = prompt_registry.schema_example("qa_test_case.schema.json")
    prompt_registry.validate_against_schema("qa_test_case.schema.json", example)


def test_validate_against_schema_rejects_missing_required_field():
    with pytest.raises(RuntimeError, match="invalid_json_response"):
        prompt_registry.validate_against_schema("qa_test_case.schema.json", {"total_criterios": 1})


def test_render_unknown_template_raises_runtime_error():
    with pytest.raises(RuntimeError, match="Prompt template nao encontrado"):
        prompt_registry.render("system/does_not_exist.j2")


def test_render_missing_variable_raises():
    """StrictUndefined: falhar cedo em vez de mandar ao modelo um prompt com buraco."""
    with pytest.raises(Exception):
        prompt_registry.render("system/qa_test_debug.j2")  # falta user_prompt e expected_json_structure


def test_build_qa_prompt_embeds_user_prompt_and_json_only_rule():
    prompt = prompts.build_qa_prompt("  Testar login com 2FA  ")
    assert "Testar login com 2FA" in prompt
    assert "SOMENTE JSON" in prompt
    assert "CT-001" in prompt  # exemplo do schema aparece no prompt


@pytest.mark.parametrize(
    "track, expected_present, expected_absent",
    [
        ("Frontend", ["UI, FUNC, UX, ACC, INT"], ["SCHEMA, FUNC, SEG, PERF, INT"]),
        ("Backend", ["SCHEMA, FUNC, SEG, PERF, INT"], ["UI, FUNC, UX, ACC, INT"]),
        ("Geral (Frontend e Backend)", ["UI, FUNC, UX, ACC, INT", "SCHEMA, FUNC, SEG, PERF, INT"], []),
    ],
)
def test_qa_generator_naming_convention_by_track(track, expected_present, expected_absent):
    prompt = prompt_registry.render(
        "system/qa_generator.j2",
        track=track,
        objective="All Objectives",
        test_type="Funcional",
        granularity="Detalhado",
        data_level="Massa de dados basica",
        work_item={"id": "1", "title": "t", "description": "d", "acceptance_criteria": "a", "tags": "x"},
        user_technical_context="n/a",
        deep_technical_detail="n/a",
        legacy_tests_for_upgrade="Nenhum",
        expected_json_structure=prompt_registry.schema_example("qa_test_case.schema.json"),
    )
    for text in expected_present:
        assert text in prompt
    for text in expected_absent:
        assert text not in prompt


class FakeCopilot:
    def __init__(self, response):
        self._response = response

    def send_prompt(self, prompt, github_token=None, preferred_model=None):
        return self._response


def test_generate_scenarios_with_copilot_validates_response():
    """Resposta do modelo faltando campo obrigatorio deve ser rejeitada com erro classificavel."""
    service = CopilotService(FakeCopilot('{"total_criterios": 1}'), prompts)

    with pytest.raises(RuntimeError, match="invalid_json_response"):
        service.generate_scenarios(
            card_data={"id": "1", "title": "t", "tags": "frontend"},
            user_focus=None,
            technical_detail=None,
            generation_settings=None,
            github_token="fake-token",
        )


def test_generate_scenarios_with_copilot_accepts_valid_response():
    import json

    example = prompt_registry.schema_example("qa_test_case.schema.json")
    service = CopilotService(FakeCopilot(json.dumps(example)), prompts)

    result = service.generate_scenarios(
        card_data={"id": "1", "title": "t", "tags": "frontend"},
        user_focus=None,
        technical_detail=None,
        generation_settings=None,
        github_token="fake-token",
    )
    assert result == example
