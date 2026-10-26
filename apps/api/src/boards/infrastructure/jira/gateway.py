"""Gateway do Jira Cloud: implementa a porta JiraBoardGateway sobre os modulos REST deste pacote."""
from . import issues


class JiraCloudGateway:
    get_issue = staticmethod(issues.get_issue)
    create_test_case = staticmethod(issues.create_test_case)
