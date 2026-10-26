import { RuntimeActions as A } from '../../../contracts/runtimeActions.js';
import * as runner from '../../../application/testRunner.js';

export function createTestRunnerHandlers(deps) {
    return {
        [A.GET_TEST_RUNNER_CARDS]: async (r) => ({ data: await runner.getRunnerCards({ query: r.query }, deps) }),
        [A.GET_TEST_CASES_FOR_WORKITEM]: async (r) => ({
            data: await runner.getTestCasesForWorkItem({ workItemId: r.workItemId }, deps)
        }),
        [A.GET_TEST_POINTS_FOR_TEST_CASES]: async (r) => ({
            data: await runner.getTestPoints({ testCaseIds: r.testCaseIds }, deps)
        }),
        [A.CREATE_TEST_RUN]: async (r) => ({
            runId: await runner.createTestRun({ title: r.title, planId: r.planId, pointIds: r.pointIds }, deps)
        }),
        [A.GET_RUN_RESULTS]: async (r) => ({ data: await runner.getRunResults({ runId: r.runId }, deps) }),
        [A.ADD_ADHOC_RESULTS]: async (r) => ({
            data: await runner.addAdhocResults({ runId: r.runId, testCaseIds: r.testCaseIds }, deps)
        }),
        [A.UPDATE_TEST_RESULT]: async (r) => {
            await runner.updateTestResult({
                runId: r.runId,
                resultId: r.resultId,
                outcome: r.outcome,
                comment: r.comment,
                stepResults: r.stepResults
            }, deps);
            return { success: true };
        },
        [A.COMPLETE_TEST_RUN]: async (r) => {
            await runner.completeTestRun({ runId: r.runId, state: r.state }, deps);
            return { success: true };
        },
        [A.CREATE_BUG]: async (r) => ({
            bugId: await runner.createBugFromFailure({
                title: r.title,
                comment: r.comment,
                testCaseId: r.testCaseId,
                workItemId: r.workItemId
            }, deps)
        }),
        [A.ADD_ATTACHMENT]: async (r) => ({
            ok: true,
            result: await runner.addAttachment({
                runId: r.runId,
                resultId: r.resultId,
                fileName: r.fileName,
                base64Content: r.base64Content,
                comment: r.comment
            }, deps)
        }),
        [A.CAPTURE_SCREENSHOT]: () => deps.captureActiveTab()
    };
}
