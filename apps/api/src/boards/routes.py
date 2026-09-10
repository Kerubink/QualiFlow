"""Endpoints REST para operacoes de board (Azure DevOps e Jira) autenticadas via OAuth."""
from flask import Blueprint, jsonify, request

from . import azure as az
from . import jira as jr
from ..auth.board_routes import get_valid_board_access_token

board_routes = Blueprint("board_routes", __name__)


def _require_board_session(provider):
    """Retorna (token_data, error_response). Se error_response nao for None, retorne-o direto."""
    session_token = request.headers.get("Authorization", "")
    if session_token.lower().startswith("bearer "):
        session_token = session_token[7:].strip()
    else:
        session_token = (request.headers.get("X-Session-Token") or "").strip()

    if not session_token:
        return None, (
            jsonify({"success": False, "error": {"code": "AUTH_REQUIRED", "message": "Sessao de board ausente."}}),
            401,
        )

    try:
        token_data, _session = get_valid_board_access_token(session_token, provider)
        return token_data, None
    except RuntimeError as error:
        code = str(error)
        message = {
            "BOARD_SESSION_INVALID": "Sessao invalida ou expirada. Faca login novamente.",
            "BOARD_SESSION_WRONG_PROVIDER": "Sessao pertence a outro provedor.",
            "BOARD_SESSION_EXPIRED": "Sessao expirada e sem refresh token. Faca login novamente.",
        }.get(code, code)
        return None, (jsonify({"success": False, "error": {"code": code, "message": message}}), 401)


def _error_response(error):
    return jsonify({"success": False, "error": {"code": "BOARD_REQUEST_ERROR", "message": str(error)}}), 502


# --- Azure DevOps ---


@board_routes.post("/api/board/azure/work-item")
def azure_work_item():
    token_data, error = _require_board_session("microsoft")
    if error:
        return error
    body = request.get_json(silent=True) or {}
    try:
        data = az.azure_get_work_item(token_data["accessToken"], body.get("orgUrl"), body.get("project"), body.get("workItemId"))
        return jsonify({"success": True, "data": data})
    except Exception as error:
        return _error_response(error)


@board_routes.post("/api/board/azure/dashboard")
def azure_dashboard():
    token_data, error = _require_board_session("microsoft")
    if error:
        return error
    body = request.get_json(silent=True) or {}
    try:
        data = az.azure_get_qa_dashboard(token_data["accessToken"], body.get("orgUrl"), body.get("project"))
        return jsonify({"success": True, "data": data})
    except Exception as error:
        return _error_response(error)


@board_routes.post("/api/board/azure/test-case-analytics")
def azure_test_case_analytics():
    token_data, error = _require_board_session("microsoft")
    if error:
        return error
    body = request.get_json(silent=True) or {}
    try:
        data = az.azure_get_test_case_analytics(token_data["accessToken"], body.get("orgUrl"), body.get("project"))
        return jsonify({"success": True, "data": data})
    except Exception as error:
        return _error_response(error)


@board_routes.post("/api/board/azure/support-cards")
def azure_support_cards():
    token_data, error = _require_board_session("microsoft")
    if error:
        return error
    body = request.get_json(silent=True) or {}
    try:
        data = az.azure_get_support_cards(token_data["accessToken"], body.get("orgUrl"), body.get("project"))
        return jsonify({"success": True, "data": data})
    except Exception as error:
        return _error_response(error)


@board_routes.post("/api/board/azure/project-iterations")
def azure_project_iterations():
    token_data, error = _require_board_session("microsoft")
    if error:
        return error
    body = request.get_json(silent=True) or {}
    try:
        data = az.azure_get_project_iterations(token_data["accessToken"], body.get("orgUrl"), body.get("project"))
        return jsonify({"success": True, "data": data})
    except Exception as error:
        return _error_response(error)


@board_routes.post("/api/board/azure/deploy-validation")
def azure_deploy_validation():
    token_data, error = _require_board_session("microsoft")
    if error:
        return error
    body = request.get_json(silent=True) or {}
    if not body.get("iterationPath"):
        return jsonify({"success": False, "error": {"code": "INVALID_BODY", "message": "Selecione uma Sprint/Iteration."}}), 400
    try:
        data = az.azure_get_deploy_validation(token_data["accessToken"], body.get("orgUrl"), body.get("project"), body.get("iterationPath"))
        return jsonify({"success": True, "data": data})
    except Exception as error:
        return _error_response(error)


@board_routes.post("/api/board/azure/test-runner-cards")
def azure_test_runner_cards():
    token_data, error = _require_board_session("microsoft")
    if error:
        return error
    body = request.get_json(silent=True) or {}
    try:
        data = az.azure_get_test_runner_cards(token_data["accessToken"], body.get("orgUrl"), body.get("project"), body.get("query"))
        return jsonify({"success": True, "data": data})
    except Exception as error:
        return _error_response(error)


@board_routes.post("/api/board/azure/test-cases-for-work-item")
def azure_test_cases_for_work_item():
    token_data, error = _require_board_session("microsoft")
    if error:
        return error
    body = request.get_json(silent=True) or {}
    try:
        data = az.azure_get_test_cases_for_work_item(token_data["accessToken"], body.get("orgUrl"), body.get("project"), body.get("workItemId"))
        return jsonify({"success": True, "data": data})
    except Exception as error:
        return _error_response(error)


@board_routes.post("/api/board/azure/test-points")
def azure_test_points():
    token_data, error = _require_board_session("microsoft")
    if error:
        return error
    body = request.get_json(silent=True) or {}
    try:
        data = az.azure_get_test_points_for_test_cases(
            token_data["accessToken"], body.get("orgUrl"), body.get("project"), body.get("testCaseIds") or []
        )
        return jsonify({"success": True, "data": data})
    except Exception as error:
        return _error_response(error)


@board_routes.post("/api/board/azure/test-run")
def azure_test_run_create():
    token_data, error = _require_board_session("microsoft")
    if error:
        return error
    body = request.get_json(silent=True) or {}
    try:
        run_id = az.azure_create_test_run(
            token_data["accessToken"], body.get("orgUrl"), body.get("project"), body.get("title"), body.get("planId"), body.get("pointIds")
        )
        return jsonify({"success": True, "runId": run_id})
    except Exception as error:
        return _error_response(error)


@board_routes.post("/api/board/azure/run-results")
def azure_run_results():
    token_data, error = _require_board_session("microsoft")
    if error:
        return error
    body = request.get_json(silent=True) or {}
    try:
        data = az.azure_get_run_results(token_data["accessToken"], body.get("orgUrl"), body.get("project"), body.get("runId"))
        return jsonify({"success": True, "data": data})
    except Exception as error:
        return _error_response(error)


@board_routes.post("/api/board/azure/adhoc-results")
def azure_adhoc_results():
    token_data, error = _require_board_session("microsoft")
    if error:
        return error
    body = request.get_json(silent=True) or {}
    try:
        data = az.azure_add_adhoc_test_results(
            token_data["accessToken"], body.get("orgUrl"), body.get("project"), body.get("runId"), body.get("testCaseIds") or []
        )
        return jsonify({"success": True, "data": data})
    except Exception as error:
        return _error_response(error)


@board_routes.post("/api/board/azure/test-result")
def azure_test_result_update():
    token_data, error = _require_board_session("microsoft")
    if error:
        return error
    body = request.get_json(silent=True) or {}
    try:
        az.azure_update_test_result(
            token_data["accessToken"],
            body.get("orgUrl"),
            body.get("project"),
            body.get("runId"),
            body.get("resultId"),
            body.get("outcome"),
            body.get("comment"),
            body.get("stepResults"),
        )
        return jsonify({"success": True})
    except Exception as error:
        return _error_response(error)


@board_routes.post("/api/board/azure/complete-run")
def azure_complete_run():
    token_data, error = _require_board_session("microsoft")
    if error:
        return error
    body = request.get_json(silent=True) or {}
    try:
        az.azure_complete_test_run(token_data["accessToken"], body.get("orgUrl"), body.get("project"), body.get("runId"), body.get("state"))
        return jsonify({"success": True})
    except Exception as error:
        return _error_response(error)


@board_routes.post("/api/board/azure/bug")
def azure_bug_create():
    token_data, error = _require_board_session("microsoft")
    if error:
        return error
    body = request.get_json(silent=True) or {}
    try:
        bug_id = az.azure_create_bug_from_failure(
            token_data["accessToken"],
            body.get("orgUrl"),
            body.get("project"),
            body.get("title"),
            body.get("comment"),
            body.get("testCaseId"),
            body.get("workItemId"),
        )
        return jsonify({"success": True, "bugId": bug_id})
    except Exception as error:
        return _error_response(error)


@board_routes.post("/api/board/azure/work-items-state")
def azure_work_items_state():
    token_data, error = _require_board_session("microsoft")
    if error:
        return error
    body = request.get_json(silent=True) or {}
    try:
        data = az.azure_update_work_items_state(
            token_data["accessToken"], body.get("orgUrl"), body.get("project"), body.get("ids") or [], body.get("newState")
        )
        return jsonify({"success": True, **data})
    except Exception as error:
        return _error_response(error)


@board_routes.post("/api/board/azure/attachment")
def azure_attachment():
    token_data, error = _require_board_session("microsoft")
    if error:
        return error
    body = request.get_json(silent=True) or {}
    try:
        data = az.azure_add_attachment(
            token_data["accessToken"],
            body.get("orgUrl"),
            body.get("project"),
            body.get("runId"),
            body.get("resultId"),
            body.get("fileName"),
            body.get("base64Content"),
            body.get("comment"),
        )
        return jsonify({"success": True, "data": data})
    except Exception as error:
        return _error_response(error)


@board_routes.post("/api/board/azure/test-case")
def azure_test_case_create():
    token_data, error = _require_board_session("microsoft")
    if error:
        return error
    body = request.get_json(silent=True) or {}
    item = body.get("item") or {}
    az.ensure_scenario_params_default(item)
    try:
        data = az.azure_create_test_case(token_data["accessToken"], body.get("orgUrl"), body.get("project"), item, body.get("parentData"))
        return jsonify({"success": True, "data": data})
    except Exception as error:
        return _error_response(error)


# --- Jira ---


@board_routes.post("/api/board/jira/issue")
def jira_issue():
    token_data, error = _require_board_session("atlassian")
    if error:
        return error
    body = request.get_json(silent=True) or {}
    try:
        data = jr.jira_get_issue(
            token_data["accessToken"],
            token_data.get("cloudId"),
            body.get("issueKey"),
            body.get("testIssueType") or "Task",
            body.get("acceptanceFieldId"),
            body.get("projectKey"),
        )
        return jsonify({"success": True, "data": data})
    except Exception as error:
        return _error_response(error)


@board_routes.post("/api/board/jira/test-case")
def jira_test_case_create():
    token_data, error = _require_board_session("atlassian")
    if error:
        return error
    body = request.get_json(silent=True) or {}
    scenario = body.get("scenario") or {}
    az.ensure_scenario_params_default(scenario)
    try:
        data = jr.jira_create_test_case(
            token_data["accessToken"],
            token_data.get("cloudId"),
            scenario,
            body.get("parentIssueKey"),
            body.get("projectKey"),
            body.get("testIssueType") or "Task",
            body.get("linkType") or "Relates",
        )
        return jsonify({"success": True, "data": data})
    except Exception as error:
        return _error_response(error)
