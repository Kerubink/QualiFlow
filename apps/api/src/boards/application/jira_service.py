"""Casos de uso de Jira. As rotas falam com este servico, nunca com o cliente REST."""
from ...shared.scenario_params import ensure_scenario_params_default
from ...shared.log import log_calls


@log_calls("jira")
class JiraBoardService:
    def __init__(self, gateway):
        self._gateway = gateway

    def get_issue(
        self, access_token, cloud_id, issue_key, test_issue_type='Task', acceptance_field_id=None, project_key=None
    ):
        return self._gateway.get_issue(
            access_token, cloud_id, issue_key, test_issue_type, acceptance_field_id, project_key
        )

    def create_test_case(
        self, access_token, cloud_id, scenario, parent_issue_key, project_key, test_issue_type='Task', link_type='Relates'
    ):
        """Garante valor padrao para os parametros @campo do cenario antes de criar a Issue."""
        ensure_scenario_params_default(scenario)
        return self._gateway.create_test_case(
            access_token, cloud_id, scenario, parent_issue_key, project_key, test_issue_type, link_type
        )
