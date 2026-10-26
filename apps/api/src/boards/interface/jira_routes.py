"""Endpoints REST de Jira (/api/board/jira/*), autenticados via sessao OAuth Atlassian."""
from flask import Blueprint, jsonify, request

from ..container import jira_service
from .common import board_error_response, require_board_session

jira_routes = Blueprint("jira_routes", __name__)


@jira_routes.post("/api/board/jira/issue")
def jira_issue():
    token_data, error = require_board_session("atlassian")
    if error:
        return error
    body = request.get_json(silent=True) or {}
    try:
        data = jira_service.get_issue(
            token_data["accessToken"],
            token_data.get("cloudId"),
            body.get("issueKey"),
            body.get("testIssueType") or "Task",
            body.get("acceptanceFieldId"),
            body.get("projectKey"),
        )
        return jsonify({"success": True, "data": data})
    except Exception as error:
        return board_error_response(error)


@jira_routes.post("/api/board/jira/test-case")
def jira_test_case_create():
    token_data, error = require_board_session("atlassian")
    if error:
        return error
    body = request.get_json(silent=True) or {}
    scenario = body.get("scenario") or {}
    try:
        data = jira_service.create_test_case(
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
        return board_error_response(error)
