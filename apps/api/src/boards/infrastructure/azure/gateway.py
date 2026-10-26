"""Gateway do Azure DevOps: implementa a porta AzureBoardGateway sobre os modulos REST deste pacote."""
from . import discovery, reports, test_cases, test_runs, work_items


class AzureDevOpsGateway:
    list_organizations = staticmethod(discovery.list_organizations)
    list_projects = staticmethod(discovery.list_projects)
    get_project_iterations = staticmethod(discovery.get_project_iterations)

    get_work_item = staticmethod(work_items.get_work_item)
    fetch_deploy_work_items = staticmethod(work_items.fetch_deploy_work_items)
    get_test_runner_cards = staticmethod(work_items.get_test_runner_cards)
    get_support_cards = staticmethod(work_items.get_support_cards)
    update_work_items_state = staticmethod(work_items.update_work_items_state)
    create_bug_from_failure = staticmethod(work_items.create_bug_from_failure)

    get_qa_dashboard = staticmethod(reports.get_qa_dashboard)
    get_test_case_analytics = staticmethod(reports.get_test_case_analytics)

    create_test_case = staticmethod(test_cases.create_test_case)
    get_test_cases_for_work_item = staticmethod(test_cases.get_test_cases_for_work_item)

    get_test_points_for_test_cases = staticmethod(test_runs.get_test_points_for_test_cases)
    create_test_run = staticmethod(test_runs.create_test_run)
    get_run_results = staticmethod(test_runs.get_run_results)
    add_adhoc_test_results = staticmethod(test_runs.add_adhoc_test_results)
    update_test_result = staticmethod(test_runs.update_test_result)
    complete_test_run = staticmethod(test_runs.complete_test_run)
    add_attachment = staticmethod(test_runs.add_attachment)
