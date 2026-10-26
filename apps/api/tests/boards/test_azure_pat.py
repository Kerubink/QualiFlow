import base64

from flask import Flask

from src.boards.infrastructure.azure.http import PersonalAccessToken, read_headers, write_headers
from src.boards.interface.common import require_board_session


def test_bearer_for_oauth_token():
    assert read_headers("tok")["Authorization"] == "Bearer tok"
    assert write_headers("tok")["Authorization"] == "Bearer tok"


def test_basic_for_pat():
    expected = "Basic " + base64.b64encode(b":segredo-de-teste").decode()
    assert read_headers(PersonalAccessToken("segredo-de-teste"))["Authorization"] == expected
    assert write_headers(PersonalAccessToken("segredo-de-teste"))["Authorization"] == expected


def test_pat_header_replaces_oauth_session_for_azure():
    app = Flask(__name__)
    with app.test_request_context(headers={"X-Azure-Pat": "pat-de-teste"}):
        token_data, error = require_board_session("microsoft")
    assert error is None
    assert isinstance(token_data["accessToken"], PersonalAccessToken)


def test_pat_header_ignored_for_jira_and_missing_session_is_401():
    app = Flask(__name__)
    with app.test_request_context(headers={"X-Azure-Pat": "pat-de-teste"}):
        token_data, error = require_board_session("atlassian")
    assert token_data is None
    assert error[1] == 401
