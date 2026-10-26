"""Casos de uso de Azure DevOps. As rotas falam com este servico, nunca com o cliente REST."""
from ...shared.scenario_params import ensure_scenario_params_default
from ..domain.deploy_validation import build_deploy_report
from ..domain.iterations import normalize_iteration_path


class AzureBoardService:
    def __init__(self, gateway):
        self._gateway = gateway

    def list_organizations(self, access_token):
        return self._gateway.list_organizations(access_token)

    def list_projects(self, access_token, org_url):
        return self._gateway.list_projects(access_token, org_url)

    def get_work_item(self, access_token, org_url, project, work_item_id):
        return self._gateway.get_work_item(access_token, org_url, project, work_item_id)

    def get_qa_dashboard(self, access_token, org_url, project):
        return self._gateway.get_qa_dashboard(access_token, org_url, project)

    def get_test_case_analytics(self, access_token, org_url, project):
        return self._gateway.get_test_case_analytics(access_token, org_url, project)

    def get_support_cards(self, access_token, org_url, project):
        return self._gateway.get_support_cards(access_token, org_url, project)

    def get_project_iterations(self, access_token, org_url, project):
        return self._gateway.get_project_iterations(access_token, org_url, project)

    def get_deploy_validation(self, access_token, org_url, project, iteration_path):
        """Busca os cards da sprint e valida a liberacao de deploy (regras em domain)."""
        if not iteration_path:
            raise RuntimeError('Iteration/Sprint nao informada.')

        normalized_path = normalize_iteration_path(iteration_path, project)
        mapped = self._gateway.fetch_deploy_work_items(access_token, org_url, project, normalized_path)
        return build_deploy_report(normalized_path, mapped)

    def get_test_runner_cards(self, access_token, org_url, project, search_query=None):
        return self._gateway.get_test_runner_cards(access_token, org_url, project, search_query)

    def get_test_cases_for_work_item(self, access_token, org_url, project, work_item_id):
        return self._gateway.get_test_cases_for_work_item(access_token, org_url, project, work_item_id)

    def get_test_points(self, access_token, org_url, project, test_case_ids):
        return self._gateway.get_test_points_for_test_cases(access_token, org_url, project, test_case_ids)

    def create_test_run(self, access_token, org_url, project, title, plan_id=None, point_ids=None):
        return self._gateway.create_test_run(access_token, org_url, project, title, plan_id, point_ids)

    def get_run_results(self, access_token, org_url, project, run_id):
        return self._gateway.get_run_results(access_token, org_url, project, run_id)

    def add_adhoc_results(self, access_token, org_url, project, run_id, test_case_ids):
        return self._gateway.add_adhoc_test_results(access_token, org_url, project, run_id, test_case_ids)

    def update_test_result(
        self, access_token, org_url, project, run_id, result_id, outcome, comment=None, step_results=None
    ):
        return self._gateway.update_test_result(
            access_token, org_url, project, run_id, result_id, outcome, comment, step_results
        )

    def complete_run(self, access_token, org_url, project, run_id, state):
        return self._gateway.complete_test_run(access_token, org_url, project, run_id, state)

    def create_bug(
        self, access_token, org_url, project, title, comment, test_case_id=None, linked_work_item_id=None
    ):
        return self._gateway.create_bug_from_failure(
            access_token, org_url, project, title, comment, test_case_id, linked_work_item_id
        )

    def update_work_items_state(self, access_token, org_url, project, ids, new_state):
        return self._gateway.update_work_items_state(access_token, org_url, project, ids, new_state)

    def add_attachment(
        self, access_token, org_url, project, run_id, result_id, file_name, base64_content, comment=None
    ):
        return self._gateway.add_attachment(
            access_token, org_url, project, run_id, result_id, file_name, base64_content, comment
        )

    def create_test_case(self, access_token, org_url, project, item, parent_data=None):
        """Garante valor padrao para os parametros @campo do cenario antes de salvar no Azure."""
        ensure_scenario_params_default(item)
        return self._gateway.create_test_case(access_token, org_url, project, item, parent_data)
