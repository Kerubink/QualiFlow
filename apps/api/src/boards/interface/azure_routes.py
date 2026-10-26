"""Endpoints REST de Azure DevOps (/api/board/azure/*), autenticados via sessao OAuth Microsoft."""
from flask import Blueprint, jsonify, request

from ..container import azure_service
from .common import board_error_response, require_board_session

azure_routes = Blueprint("azure_routes", __name__)


@azure_routes.post("/api/board/azure/organizations")
def azure_organizations():
    """Lista as organizacoes do Azure DevOps acessiveis pelo usuario autenticado (auto-discovery
    apos o login Microsoft, para nao exigir digitar a URL da organizacao manualmente)."""
    token_data, error = require_board_session("microsoft")
    if error:
        return error
    try:
        data = azure_service.list_organizations(token_data["accessToken"])
        return jsonify({"success": True, "data": data})
    except Exception as error:
        return board_error_response(error)


@azure_routes.post("/api/board/azure/projects")
def azure_projects():
    """Lista os projetos de uma organizacao do Azure DevOps (auto-discovery apos escolher a
    organizacao, para nao exigir digitar o nome do projeto manualmente)."""
    token_data, error = require_board_session("microsoft")
    if error:
        return error
    body = request.get_json(silent=True) or {}
    org_url = (body.get("orgUrl") or "").strip()
    if not org_url:
        return (
            jsonify({"success": False, "error": {"code": "INVALID_BODY", "message": "Body invalido. Envie orgUrl no payload."}}),
            400,
        )
    try:
        data = azure_service.list_projects(token_data["accessToken"], org_url)
        return jsonify({"success": True, "data": data})
    except Exception as error:
        return board_error_response(error)


@azure_routes.post("/api/board/azure/work-item")
def azure_work_item():
    token_data, error = require_board_session("microsoft")
    if error:
        return error
    body = request.get_json(silent=True) or {}
    try:
        data = azure_service.get_work_item(token_data["accessToken"], body.get("orgUrl"), body.get("project"), body.get("workItemId"))
        return jsonify({"success": True, "data": data})
    except Exception as error:
        return board_error_response(error)


@azure_routes.post("/api/board/azure/dashboard")
def azure_dashboard():
    token_data, error = require_board_session("microsoft")
    if error:
        return error
    body = request.get_json(silent=True) or {}
    try:
        data = azure_service.get_qa_dashboard(token_data["accessToken"], body.get("orgUrl"), body.get("project"))
        return jsonify({"success": True, "data": data})
    except Exception as error:
        return board_error_response(error)


@azure_routes.post("/api/board/azure/test-case-analytics")
def azure_test_case_analytics():
    token_data, error = require_board_session("microsoft")
    if error:
        return error
    body = request.get_json(silent=True) or {}
    try:
        data = azure_service.get_test_case_analytics(token_data["accessToken"], body.get("orgUrl"), body.get("project"))
        return jsonify({"success": True, "data": data})
    except Exception as error:
        return board_error_response(error)


@azure_routes.post("/api/board/azure/support-cards")
def azure_support_cards():
    token_data, error = require_board_session("microsoft")
    if error:
        return error
    body = request.get_json(silent=True) or {}
    try:
        data = azure_service.get_support_cards(token_data["accessToken"], body.get("orgUrl"), body.get("project"))
        return jsonify({"success": True, "data": data})
    except Exception as error:
        return board_error_response(error)


@azure_routes.post("/api/board/azure/project-iterations")
def azure_project_iterations():
    token_data, error = require_board_session("microsoft")
    if error:
        return error
    body = request.get_json(silent=True) or {}
    try:
        data = azure_service.get_project_iterations(token_data["accessToken"], body.get("orgUrl"), body.get("project"))
        return jsonify({"success": True, "data": data})
    except Exception as error:
        return board_error_response(error)


@azure_routes.post("/api/board/azure/deploy-validation")
def azure_deploy_validation():
    token_data, error = require_board_session("microsoft")
    if error:
        return error
    body = request.get_json(silent=True) or {}
    if not body.get("iterationPath"):
        return jsonify({"success": False, "error": {"code": "INVALID_BODY", "message": "Selecione uma Sprint/Iteration."}}), 400
    try:
        data = azure_service.get_deploy_validation(token_data["accessToken"], body.get("orgUrl"), body.get("project"), body.get("iterationPath"))
        return jsonify({"success": True, "data": data})
    except Exception as error:
        return board_error_response(error)


@azure_routes.post("/api/board/azure/test-runner-cards")
def azure_test_runner_cards():
    token_data, error = require_board_session("microsoft")
    if error:
        return error
    body = request.get_json(silent=True) or {}
    try:
        data = azure_service.get_test_runner_cards(token_data["accessToken"], body.get("orgUrl"), body.get("project"), body.get("query"))
        return jsonify({"success": True, "data": data})
    except Exception as error:
        return board_error_response(error)


@azure_routes.post("/api/board/azure/test-cases-for-work-item")
def azure_test_cases_for_work_item():
    token_data, error = require_board_session("microsoft")
    if error:
        return error
    body = request.get_json(silent=True) or {}
    try:
        data = azure_service.get_test_cases_for_work_item(token_data["accessToken"], body.get("orgUrl"), body.get("project"), body.get("workItemId"))
        return jsonify({"success": True, "data": data})
    except Exception as error:
        return board_error_response(error)


@azure_routes.post("/api/board/azure/test-points")
def azure_test_points():
    token_data, error = require_board_session("microsoft")
    if error:
        return error
    body = request.get_json(silent=True) or {}
    try:
        data = azure_service.get_test_points(
            token_data["accessToken"], body.get("orgUrl"), body.get("project"), body.get("testCaseIds") or []
        )
        return jsonify({"success": True, "data": data})
    except Exception as error:
        return board_error_response(error)


@azure_routes.post("/api/board/azure/test-run")
def azure_test_run_create():
    token_data, error = require_board_session("microsoft")
    if error:
        return error
    body = request.get_json(silent=True) or {}
    try:
        run_id = azure_service.create_test_run(
            token_data["accessToken"], body.get("orgUrl"), body.get("project"), body.get("title"), body.get("planId"), body.get("pointIds")
        )
        return jsonify({"success": True, "runId": run_id})
    except Exception as error:
        return board_error_response(error)


@azure_routes.post("/api/board/azure/run-results")
def azure_run_results():
    token_data, error = require_board_session("microsoft")
    if error:
        return error
    body = request.get_json(silent=True) or {}
    try:
        data = azure_service.get_run_results(token_data["accessToken"], body.get("orgUrl"), body.get("project"), body.get("runId"))
        return jsonify({"success": True, "data": data})
    except Exception as error:
        return board_error_response(error)


@azure_routes.post("/api/board/azure/adhoc-results")
def azure_adhoc_results():
    token_data, error = require_board_session("microsoft")
    if error:
        return error
    body = request.get_json(silent=True) or {}
    try:
        data = azure_service.add_adhoc_results(
            token_data["accessToken"], body.get("orgUrl"), body.get("project"), body.get("runId"), body.get("testCaseIds") or []
        )
        return jsonify({"success": True, "data": data})
    except Exception as error:
        return board_error_response(error)


@azure_routes.post("/api/board/azure/test-result")
def azure_test_result_update():
    token_data, error = require_board_session("microsoft")
    if error:
        return error
    body = request.get_json(silent=True) or {}
    try:
        azure_service.update_test_result(
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
        return board_error_response(error)


@azure_routes.post("/api/board/azure/complete-run")
def azure_complete_run():
    token_data, error = require_board_session("microsoft")
    if error:
        return error
    body = request.get_json(silent=True) or {}
    try:
        azure_service.complete_run(token_data["accessToken"], body.get("orgUrl"), body.get("project"), body.get("runId"), body.get("state"))
        return jsonify({"success": True})
    except Exception as error:
        return board_error_response(error)


@azure_routes.post("/api/board/azure/bug")
def azure_bug_create():
    token_data, error = require_board_session("microsoft")
    if error:
        return error
    body = request.get_json(silent=True) or {}
    try:
        bug_id = azure_service.create_bug(
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
        return board_error_response(error)


@azure_routes.post("/api/board/azure/work-items-state")
def azure_work_items_state():
    token_data, error = require_board_session("microsoft")
    if error:
        return error
    body = request.get_json(silent=True) or {}
    try:
        data = azure_service.update_work_items_state(
            token_data["accessToken"], body.get("orgUrl"), body.get("project"), body.get("ids") or [], body.get("newState")
        )
        return jsonify({"success": True, **data})
    except Exception as error:
        return board_error_response(error)


@azure_routes.post("/api/board/azure/attachment")
def azure_attachment():
    token_data, error = require_board_session("microsoft")
    if error:
        return error
    body = request.get_json(silent=True) or {}
    try:
        data = azure_service.add_attachment(
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
        return board_error_response(error)


@azure_routes.post("/api/board/azure/test-case")
def azure_test_case_create():
    token_data, error = require_board_session("microsoft")
    if error:
        return error
    body = request.get_json(silent=True) or {}
    item = body.get("item") or {}
    try:
        data = azure_service.create_test_case(token_data["accessToken"], body.get("orgUrl"), body.get("project"), item, body.get("parentData"))
        return jsonify({"success": True, "data": data})
    except Exception as error:
        return board_error_response(error)
