import json

from src.generation.application.generation_service import GenerationService
from src.generation.domain.deduplication import are_duplicates, remove_duplicate_scenarios
from src.generation.domain.post_processing import post_process_generated_scenarios
from src.generation.infrastructure.prompts import PromptCatalog

CARD = {"id": "1", "title": "Login", "description": "d", "acceptance_criteria": "Deve pedir codigo"}


def _scenario(title, *actions):
    return {"title": title, "steps": [{"action": action, "expected": "ok"} for action in actions]}


LOGIN_STEPS = (
    "DADO que o usuario esta na tela de login",
    "QUANDO informa um codigo de acesso invalido",
    "ENTAO o sistema exibe a mensagem de codigo invalido",
)


def test_same_title_with_different_prefix_or_accents_is_duplicate():
    a = _scenario("FUNC - Login - Rejeita código inválido", *LOGIN_STEPS)
    b = _scenario("[UI] - login - rejeita codigo invalido", "DADO outra coisa totalmente diferente aqui")
    assert are_duplicates(a, b)


def test_same_flow_with_reworded_title_is_duplicate():
    a = _scenario("FUNC - Login - Rejeita codigo invalido", *LOGIN_STEPS)
    b = _scenario("FUNC - Autenticacao - Bloqueia acesso com codigo errado", *LOGIN_STEPS)
    assert are_duplicates(a, b)


def test_distinct_scenarios_are_kept():
    a = _scenario("FUNC - Login - Rejeita codigo invalido", *LOGIN_STEPS)
    b = _scenario(
        "FUNC - Login - Aceita codigo valido",
        "DADO que o usuario esta na tela de login",
        "QUANDO informa um codigo de acesso valido",
        "ENTAO o sistema libera o acesso ao painel principal",
    )
    unique, removed = remove_duplicate_scenarios([a, b])
    assert unique == [a, b] and removed == []


def test_first_occurrence_is_kept():
    a = _scenario("FUNC - Login - Rejeita codigo invalido", *LOGIN_STEPS)
    b = _scenario("FUNC - Login - Rejeita codigo invalido", *LOGIN_STEPS)
    unique, removed = remove_duplicate_scenarios([a, b])
    assert unique == [a] and removed == [b]


def test_post_processing_drops_duplicates_and_recomputes_totals():
    raw = {
        "test_cases": [
            _scenario("FUNC - Login - Rejeita codigo invalido", *LOGIN_STEPS),
            _scenario("FUNC - Login - Rejeita codigo invalido", *LOGIN_STEPS),
        ]
    }
    result = post_process_generated_scenarios(raw, CARD)
    assert result["total_tests"] == 1 and len(result["test_cases"]) == 1


class _Ai:
    def __init__(self, handler):
        self.handler, self.prompts = handler, []

    def json_prompt(self, selected_ai, ai_settings, prompt, temperature=0.2, github_token=None):
        self.prompts.append(prompt)
        return self.handler(json.loads(prompt))


def test_later_batches_receive_already_generated_and_repeats_are_removed():
    plan = [{"id": f"CT{i}", "title": f"t{i}", "type": "Functional", "prefix": "FUNC", "acceptance_refs": []} for i in range(4)]
    batch_payloads = []

    def handler(payload):
        stage = payload["stage"]
        if stage == "decomposition":
            return {"rules": [], "test_plan": plan}
        if stage == "batch-generation":
            batch_payloads.append(payload)
            if len(batch_payloads) == 1:
                return {"test_cases": [_scenario("FUNC - Login - Rejeita codigo invalido", *LOGIN_STEPS)]}
            # o modelo repete o CT do lote 1 e traz um novo
            return {
                "test_cases": [
                    _scenario("FUNC - Login - Rejeita codigo invalido", *LOGIN_STEPS),
                    _scenario("FUNC - Login - Aceita codigo valido", "DADO a tela", "QUANDO informa codigo valido", "ENTAO acessa o painel"),
                ]
            }
        return {"coverage_analysis": {"rtm_matrix": [], "insights": "x", "coverage_score": "0%"}}

    service = GenerationService(_Ai(handler), PromptCatalog())
    events = list(
        service.orchestrate_scenario_generation("gemini", {"generationChunkSize": 2}, CARD, "", "", {"type": "Functional"})
    )
    result = [payload for kind, payload in events if kind == "result"][0]

    assert batch_payloads[0]["already_generated"] == []
    assert [item["title"] for item in batch_payloads[1]["already_generated"]] == ["FUNC - Login - Rejeita codigo invalido"]
    assert [t["title"] for t in result["test_cases"]] == [
        "FUNC - Login - Rejeita codigo invalido",
        "FUNC - Login - Aceita codigo valido",
    ]


def test_progress_heartbeats_keep_stream_alive_during_slow_ai_call(monkeypatch):
    import time

    from src.generation.application import generation_service as module

    monkeypatch.setattr(module, "HEARTBEAT_SECONDS", 0.05)

    def handler(payload):
        stage = payload["stage"]
        if stage == "decomposition":
            return {"rules": [], "test_plan": [{"id": "CT1", "title": "t", "type": "Functional", "prefix": "FUNC", "acceptance_refs": []}]}
        if stage == "batch-generation":
            time.sleep(0.2)  # chamada lenta
            return {"test_cases": [_scenario("FUNC - Login - Rejeita codigo invalido", *LOGIN_STEPS)]}
        return {"coverage_analysis": {"rtm_matrix": [], "insights": "x", "coverage_score": "0%"}}

    service = GenerationService(_Ai(handler), PromptCatalog())
    events = list(service.orchestrate_scenario_generation("gemini", {}, CARD, "", "", {"type": "Functional"}))
    heartbeats = [p for kind, p in events if kind == "progress" and p.get("waitingSeconds") is not None]

    assert heartbeats and all(p["stage"] == "batch-progress" and p["batchIndex"] == 1 for p in heartbeats)
    assert "aguardando a IA" in heartbeats[0]["message"]
    assert [p for kind, p in events if kind == "result"]
