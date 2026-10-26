"""Testes unitarios offline das regras puras de src/boards/domain (sem Flask, rede ou I/O)."""
from src.boards.application.azure_service import AzureBoardService
from src.boards.domain.adf import adf_to_plain_text, to_adf_paragraph
from src.boards.domain.assignee import is_valid_assignee
from src.boards.domain.deploy_validation import build_deploy_report
from src.boards.domain.iterations import build_iteration_options, normalize_iteration_path
from src.boards.domain.jira_issues import build_test_case_description, is_likely_test_issue
from src.boards.domain.test_case_xml import (
    format_local_data_source_xml,
    format_parameters_xml,
    parse_test_steps_xml,
    steps_to_xml,
)
from src.shared.scenario_params import ensure_scenario_params_default, extract_scenario_params


def test_steps_to_xml_escapes_special_characters_and_marks_evidence():
    xml = steps_to_xml([{"action": 'clica em "A" & <B>', "expected": "it's ok", "needs_evidence": True}])

    assert '<steps id="0" last="1">' in xml
    assert "&quot;A&quot; &amp; &lt;B&gt;" in xml
    assert "it&apos;s ok" in xml
    assert "EVIDÊNCIA OBRIGATÓRIA" in xml


def test_parse_test_steps_xml_roundtrip_and_empty():
    steps = parse_test_steps_xml(steps_to_xml([{"action": "DADO algo", "expected": "ok"}, {"action": "QUANDO x", "expected": "y"}]))

    assert [(step["action"], step["expected"]) for step in steps] == [("DADO algo", "ok"), ("QUANDO x", "y")]
    assert parse_test_steps_xml("") == []


def test_parameters_xml_strips_at_prefix():
    assert format_parameters_xml({"@user": "a"}) == '<parameters><param name="user" bind="default"/></parameters>'
    assert format_parameters_xml({}) == ""
    assert "<user>a</user>" in format_local_data_source_xml({"@user": "a"})


def test_scenario_params_are_ordered_and_default_to_placeholder():
    item = {"title": "Login @user", "steps": [{"action": "digita @senha", "expected": "valida @user"}], "parameters": {"@user": "  "}}

    assert extract_scenario_params(item) == ["@user", "@senha"]
    ensure_scenario_params_default(item)
    assert item["parameters"] == {"@user": "###", "@senha": "###"}


def test_is_valid_assignee_accepts_email_and_rejects_free_text():
    assert is_valid_assignee("qa@empresa.com")
    assert not is_valid_assignee("Fulano de Tal")
    assert not is_valid_assignee("   ")
    assert not is_valid_assignee(None)


def test_normalize_iteration_path_drops_iteration_segment():
    assert normalize_iteration_path("\\Proj\\Iteration\\Sprint 1", "Proj") == "Proj\\Sprint 1"
    assert normalize_iteration_path("\\Proj\\Sprint 1", "Proj") == "Proj\\Sprint 1"


def test_build_iteration_options_keeps_leaves_newest_first():
    tree = {
        "name": "Proj", "path": "\\Proj\\Iteration", "structureType": "iteration", "hasChildren": True,
        "children": [
            {"name": "Sprint 2", "path": "\\Proj\\Iteration\\Sprint 2", "structureType": "iteration"},
            {"name": "Sprint 10", "path": "\\Proj\\Iteration\\Sprint 10", "structureType": "iteration"},
        ],
    }

    options = build_iteration_options(tree, "Proj")

    assert [option["name"] for option in options] == ["Sprint 10", "Sprint 2"]
    assert options[0]["path"] == "Proj\\Sprint 10"


def _card(card_id, work_type, state, tags, relations=None):
    return {
        "id": card_id, "title": f"Card {card_id}", "state": state, "type": work_type, "tags": tags,
        "areaPath": "Proj\\Area", "url": "u", "_relations": relations or [],
    }


def test_build_deploy_report_validates_tags_and_aggregates_children():
    child_rel = {"rel": "System.LinkTypes.Hierarchy-forward", "url": "https://x/_apis/wit/workItems/2"}
    mapped = [
        _card(1, "Product Backlog Item", "Teste OK", "Front; Liberado deploy", [child_rel]),
        _card(2, "Task", "Teste OK", "Front"),  # sem tag de deploy -> problema herdado pelo pai
        _card(3, "Bug", "Teste OK", "Backend; Liberado deploy"),
    ]

    report = build_deploy_report("Proj\\Sprint 1", mapped)

    by_id = {item["id"]: item for item in report["items"]}
    assert by_id[3]["liberado"] == "yes"
    assert by_id[1]["liberado"] == "no"
    assert "Filho #2" in by_id[1]["issues"][0]
    assert report["summary"] == {"total": 3, "liberados": 1, "problemas": 2, "pendentes": 0}
    assert "_relations" not in by_id[1]


def test_build_deploy_report_empty_sprint():
    assert build_deploy_report("Proj\\S", []) == {
        "iterationPath": "Proj\\S",
        "items": [],
        "summary": {"total": 0, "liberados": 0, "problemas": 0, "pendentes": 0},
    }


class _FakeAzureGateway:
    def __init__(self, mapped):
        self.mapped = mapped
        self.calls = []

    def fetch_deploy_work_items(self, access_token, org_url, project, iteration_path):
        self.calls.append(iteration_path)
        return self.mapped


def test_azure_service_deploy_validation_normalizes_path_and_requires_iteration():
    gateway = _FakeAzureGateway([])
    service = AzureBoardService(gateway)

    report = service.get_deploy_validation("tok", "https://dev.azure.com/o", "Proj", "\\Proj\\Iteration\\Sprint 1")

    assert gateway.calls == ["Proj\\Sprint 1"]
    assert report["iterationPath"] == "Proj\\Sprint 1"
    try:
        service.get_deploy_validation("tok", "https://dev.azure.com/o", "Proj", "")
        assert False, "deveria exigir a iteration"
    except RuntimeError as error:
        assert "Iteration" in str(error)


def test_adf_roundtrip_to_plain_text():
    doc = {"type": "doc", "version": 1, "content": [to_adf_paragraph("linha 1"), to_adf_paragraph("linha 2")]}

    assert adf_to_plain_text(doc) == "linha 1\nlinha 2"
    assert adf_to_plain_text(None) == ""
    assert adf_to_plain_text("ja e texto") == "ja e texto"


def test_is_likely_test_issue_by_type_or_label():
    assert is_likely_test_issue({"fields": {"issuetype": {"name": "Task"}, "labels": []}}, "Task")
    assert is_likely_test_issue({"fields": {"issuetype": {"name": "Bug"}, "labels": ["QualiFlow"]}}, "Task")
    assert not is_likely_test_issue({"fields": {"issuetype": {"name": "Bug"}, "labels": []}}, "Task")


def test_build_test_case_description_lists_numbered_steps():
    text = build_test_case_description(
        {"bdd_description": "DADO x", "steps": [{"action": "a", "expected": "b"}, {"action": "c", "expected": "d"}]}
    )

    assert text == "DADO x\n\nPassos do Teste:\n1. Acao: a | Esperado: b\n2. Acao: c | Esperado: d"
