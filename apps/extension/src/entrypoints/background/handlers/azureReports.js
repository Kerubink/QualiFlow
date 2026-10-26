import { RuntimeActions as A } from '../../../contracts/runtimeActions.js';
import * as reports from '../../../application/azureReports.js';

// Dashboard, analytics, suporte e administracao do Azure (orgs/projetos/estado dos work items).
export function createAzureReportHandlers(deps, supportMonitor) {
    return {
        [A.GET_DASHBOARD_DATA]: async () => ({ data: await reports.getQaDashboard(deps) }),
        [A.GET_TEST_CASE_ANALYTICS]: async () => ({ data: await reports.getTestCaseAnalytics(deps) }),
        [A.GET_SUPPORT_CARDS]: async () => ({ data: await reports.getSupportCards(deps) }),
        [A.GET_PROJECT_ITERATIONS]: async () => ({ data: await reports.getProjectIterations(deps) }),
        [A.GET_DEPLOY_VALIDATION]: async (request) => ({
            data: await reports.getDeployValidation({ iterationPath: request.iterationPath }, deps)
        }),
        [A.UPDATE_WORK_ITEMS_STATE]: (request) =>
            reports.updateWorkItemsState({ ids: request.ids, newState: request.newState }, deps),

        [A.RUN_SUPPORT_MONITOR_NOW]: async () => {
            try {
                const result = await supportMonitor.run({ forceNotifyNovo: true });
                return { ok: true, result };
            } catch (err) {
                return { ok: false, error: err.message };
            }
        },

        [A.GET_AZURE_ORGANIZATIONS]: async () => {
            try {
                return { success: true, organizations: await reports.listAzureOrganizations(deps) };
            } catch (err) {
                return { success: false, error: err.message };
            }
        },
        [A.GET_AZURE_PROJECTS]: async (request) => {
            try {
                return { success: true, projects: await reports.listAzureProjects({ orgUrl: request.orgUrl }, deps) };
            } catch (err) {
                return { success: false, error: err.message };
            }
        }
    };
}
