"""Testes "golden" dos prompts de orquestracao (decomposicao/lote/RTM/adaptacao) e do
GenerationService (pipeline em lotes, fallback legado, avaliacao de cobertura)."""
import json

import pytest

from src.generation.application.generation_service import GenerationService
from src.generation.infrastructure.prompts import PromptCatalog

prompts = PromptCatalog()

CARD_DATA = {
    "id": "CARD-1",
    "title": "Login com 2FA",
    "description": "Permitir login com autenticacao de dois fatores",
    "acceptance_criteria": "- Deve pedir codigo\n- Deve validar codigo",
    "tags": "frontend",
}


@pytest.mark.parametrize(
    "builder, kwargs",
    [
        (
            prompts.build_decomposition_prompt,
            dict(
                card_data=CARD_DATA,
                user_focus="foco",
                technical_detail="detalhe",
                generation_settings={"objective": "All Objectives"},
                criteria_list=["Deve pedir codigo", "Deve validar codigo"],
            ),
        ),
        (
            prompts.build_batch_prompt,
            dict(
                card_data=CARD_DATA,
                criteria_list=["Deve pedir codigo"],
                rules=["regra 1"],
                batch_plan=[{"id": "CT01"}],
                generation_settings={"type": "Funcional"},
                user_focus="foco",
                technical_detail="detalhe",
            ),
        ),
        (
            prompts.build_rtm_prompt,
            dict(
                criteria_list=["Deve pedir codigo"],
                generated_tests=[{"id": "CT1", "title": "t", "bdd_description": "d", "steps": []}],
            ),
        ),
        (
            prompts.build_adaptation_prompt,
            dict(
                target_card_data=CARD_DATA,
                source_work_item={"id": "SRC", "title": "Origem"},
                copied_scenarios=[{"title": "t", "steps": []}],
                criteria_list=["Deve pedir codigo"],
                generation_settings={},
                user_focus="foco",
                technical_detail="detalhe",
            ),
        ),
    ],
    ids=["decomposition", "batch", "rtm", "adaptation"],
)
def test_stage_prompt_renders_valid_json(builder, kwargs):
    """Os 4 prompts de estagio sao objetos JSON completos (technique 'JSON-in/JSON-out')."""
    prompt = builder(**kwargs)
    parsed = json.loads(prompt)
    assert "objective" in parsed
    assert "constraints" in parsed


def test_batch_and_adaptation_use_same_newline_convention_in_bdd_example():
    """Regressao: build_batch_prompt e build_adaptation_prompt antes escapavam o exemplo de
    bdd_description de formas diferentes (\\n duplo vs \\n simples). Migrar os dois para o
    mesmo mecanismo (tojson) elimina essa divergencia."""
    batch_prompt = prompts.build_batch_prompt(
        card_data=CARD_DATA,
        criteria_list=["c"],
        rules=[],
        batch_plan=[],
        generation_settings={},
        user_focus="",
        technical_detail="",
    )
    adaptation_prompt = prompts.build_adaptation_prompt(
        target_card_data=CARD_DATA,
        source_work_item={},
        copied_scenarios=[],
        criteria_list=["c"],
        generation_settings={},
        user_focus="",
        technical_detail="",
    )
    batch_example = json.loads(batch_prompt)["output_schema"]["test_cases"][0]["bdd_description"]
    adaptation_example = json.loads(adaptation_prompt)["output_schema"]["test_cases"][0]["bdd_description"]
    assert "\n" in batch_example
    assert "\n" in adaptation_example
    assert "\\n" not in batch_example.replace("\n", "")  # sem barra invertida sobrando


class FakeAi:
    """AiGateway falso: devolve respostas de `handler(prompt)` e registra os prompts recebidos."""

    def __init__(self, handler):
        self._handler = handler
        self.prompts = []

    def json_prompt(self, selected_ai, ai_settings, prompt, temperature=0.2, github_token=None):
        self.prompts.append(prompt)
        return self._handler(prompt)

    def text_prompt(self, selected_ai, ai_settings, prompt, temperature=0.3, github_token=None):
        self.prompts.append(prompt)
        return self._handler(prompt)


def test_legacy_generate_scenarios_end_to_end():
    ai = FakeAi(lambda prompt: {"total_criterios": 1, "total_tests": 1, "coverage_analysis": {}, "test_cases": []})
    service = GenerationService(ai, prompts)

    result = service.legacy_generate_scenarios("gemini", {}, CARD_DATA, "foco", "detalhe", {"objective": "All Objectives"})

    assert result["total_tests"] == 1
    assert "Aja como QA Senior" in ai.prompts[0]


def test_legacy_generate_scenarios_uses_the_shared_generation_prompt():
    """O fallback single-shot precisa gerar o MESMO prompt do endpoint dedicado do Copilot -- sao a
    mesma regra de negocio, so o provedor de IA muda."""
    args = (CARD_DATA, "foco", "detalhe", {"objective": "All Objectives"})
    ai = FakeAi(lambda prompt: {})
    GenerationService(ai, prompts).legacy_generate_scenarios("gemini", {}, *args)

    assert ai.prompts == [prompts.build_qa_generation_prompt(*args)]


def test_evaluate_coverage_without_existing_tests_short_circuits():
    ai = FakeAi(lambda prompt: "nao deveria ser chamado")
    result = GenerationService(ai, prompts).evaluate_coverage("gemini", {"id": "1"}, {})

    assert result == "Nao ha testes existentes para avaliar."
    assert ai.prompts == []


def test_evaluate_coverage_uses_evaluation_prompt():
    card_with_tests = {**CARD_DATA, "existing_tests": [{"title": "t"}]}
    ai = FakeAi(lambda prompt: "avaliacao")

    result = GenerationService(ai, prompts).evaluate_coverage("gemini", card_with_tests, {})

    assert result == "avaliacao"
    assert ai.prompts == [prompts.build_qa_evaluation_prompt(card_with_tests)]


def test_orchestrate_scenario_generation_survives_single_batch_failure():
    """Regressao: uma falha em UM lote nao pode descartar os casos de teste ja gerados pelos
    outros lotes -- antes, isso derrubava a geracao inteira e caia no fallback legado
    (single-shot, sem decomposicao), que tende a gerar bem menos casos de teste."""
    test_plan = [{"id": f"CT{i}", "title": f"t{i}", "type": "Functional", "prefix": "FUNC", "acceptance_refs": []} for i in range(6)]
    batch_calls = {"count": 0}

    def handler(prompt):
        payload = json.loads(prompt)
        stage = payload.get("stage")
        if stage == "decomposition":
            return {"rules": [], "test_plan": test_plan}
        if stage == "batch-generation":
            batch_calls["count"] += 1
            if batch_calls["count"] == 1:
                raise RuntimeError("falha simulada no primeiro lote")
            return {
                "test_cases": [
                    {"id": item["id"], "title": item["title"], "bdd_description": "", "steps": []}
                    for item in payload["batch_plan"]
                ]
            }
        if stage == "rtm":
            return {"coverage_analysis": {"rtm_matrix": [], "insights": "x", "coverage_score": "0%"}}
        raise AssertionError(f"stage inesperado: {stage}")

    service = GenerationService(FakeAi(handler), prompts)

    events = list(
        service.orchestrate_scenario_generation(
            "gemini", {"generationChunkSize": 3}, CARD_DATA, "foco", "detalhe", {"objective": "All Objectives"}
        )
    )
    results = [payload for kind, payload in events if kind == "result"]

    assert batch_calls["count"] == 2  # dois lotes de 3 (chunk_size=3) para 6 itens de test_plan
    assert len(results) == 1
    assert results[0]["total_tests"] == 3  # so o segundo lote (3 itens) sobreviveu


def test_stream_generation_falls_back_to_legacy_and_emits_ndjson_events():
    """Se a orquestracao completa falha, o stream emite 'progress' de fallback e termina com 'result'."""
    calls = {"count": 0}

    def handler(prompt):
        calls["count"] += 1
        if "Aja como QA Senior" in prompt:  # prompt legado (single-shot)
            return {"test_cases": [{"title": "CT legado", "steps": []}]}
        raise RuntimeError("falha simulada na orquestracao")

    events = list(
        GenerationService(FakeAi(handler), prompts).stream_generation(
            "gemini", {}, CARD_DATA, "foco", "detalhe", {"objective": "All Objectives"}
        )
    )

    assert [event["type"] for event in events[:-1]] == ["progress"] * (len(events) - 1)
    assert events[-2]["stage"] == "fallback"
    assert events[-1]["type"] == "result"
    assert events[-1]["data"]["total_tests"] == 1


def test_stream_generation_emits_classified_error_event_when_fallback_also_fails():
    def handler(prompt):
        raise RuntimeError("API Key do Gemini nao configurada.")

    events = list(
        GenerationService(FakeAi(handler), prompts).stream_generation(
            "gemini", {}, CARD_DATA, None, None, {"objective": "All Objectives"}
        )
    )

    assert events[-1]["type"] == "error"
    assert events[-1]["error"]["code"] == "AI_KEY_MISSING"
