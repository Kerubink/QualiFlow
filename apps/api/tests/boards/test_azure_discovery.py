"""Testes de src.boards.infrastructure.azure.discovery (list_organizations / list_projects) (auto-discovery
de organizacao/projeto do Azure DevOps apos o login Microsoft OAuth)."""
from unittest.mock import MagicMock, patch

from src.boards.infrastructure.azure import discovery as az


def _fake_response(payload):
    response = MagicMock()
    response.ok = True
    response.json.return_value = payload
    return response


def test_azure_list_organizations_builds_url_and_sorts_by_name():
    def fake_get(url, headers=None, timeout=None):
        if "profiles/me" in url:
            return _fake_response({"id": "profile-123"})
        if "_apis/accounts" in url:
            assert "memberId=profile-123" in url
            return _fake_response({"value": [{"accountName": "ZebraOrg"}, {"accountName": "AlphaOrg"}]})
        raise AssertionError(f"unexpected url: {url}")

    with patch("src.boards.infrastructure.azure.discovery.requests.get", side_effect=fake_get):
        organizations = az.list_organizations("fake-token")

    assert organizations == [
        {"name": "AlphaOrg", "url": "https://dev.azure.com/AlphaOrg"},
        {"name": "ZebraOrg", "url": "https://dev.azure.com/ZebraOrg"},
    ]


def test_azure_list_organizations_raises_without_profile_id():
    with patch("src.boards.infrastructure.azure.discovery.requests.get", return_value=_fake_response({})):
        try:
            az.list_organizations("fake-token")
            assert False, "deveria ter levantado RuntimeError"
        except RuntimeError as error:
            assert "perfil" in str(error).lower()


def test_azure_list_projects_strips_trailing_slash_and_sorts_by_name():
    def fake_get(url, headers=None, timeout=None):
        assert url == "https://dev.azure.com/AlphaOrg/_apis/projects?api-version=7.1&$top=1000"
        return _fake_response({"value": [{"id": "p2", "name": "Zulu"}, {"id": "p1", "name": "Alpha"}]})

    with patch("src.boards.infrastructure.azure.discovery.requests.get", side_effect=fake_get):
        projects = az.list_projects("fake-token", "https://dev.azure.com/AlphaOrg/")

    assert projects == [{"id": "p1", "name": "Alpha"}, {"id": "p2", "name": "Zulu"}]


def test_azure_list_projects_requires_org_url():
    try:
        az.list_projects("fake-token", "")
        assert False, "deveria ter levantado RuntimeError"
    except RuntimeError as error:
        assert "org_url" in str(error)
