import { RuntimeActions as A } from '../../../contracts/runtimeActions.js';
import {
    pollBoardLogin,
    pollCopilotLogin,
    startBoardLogin,
    startCopilotLogin
} from '../../../application/oauthSessions.js';

async function respond(work) {
    try {
        return { success: true, ...(await work()) };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

// Retorna o pollPath saneado ou null quando ausente.
function readPollPath(request) {
    return (request.pollPath || '').trim() || null;
}

export function createAuthHandlers(deps) {
    const pollPathMissing = { success: false, error: 'pollPath nao informado.' };

    const startBoard = (provider) => (request) =>
        respond(() => startBoardLogin({ provider, backendUrl: request.backendUrl, jiraDomain: request.jiraDomain }, deps));

    const pollBoard = (provider) => (request) => {
        const pollPath = readPollPath(request);
        if (!pollPath) return pollPathMissing;
        return respond(() => pollBoardLogin({ provider, pollPath, backendUrl: request.backendUrl }, deps));
    };

    return {
        [A.COPILOT_AUTH_START]: (request) =>
            respond(() => startCopilotLogin({ backendUrl: request.backendUrl }, deps)),
        [A.COPILOT_AUTH_POLL]: (request) => {
            const pollPath = readPollPath(request);
            if (!pollPath) return pollPathMissing;
            return respond(() => pollCopilotLogin({ pollPath, backendUrl: request.backendUrl }, deps));
        },
        [A.AZURE_AUTH_START]: startBoard('microsoft'),
        [A.JIRA_AUTH_START]: startBoard('atlassian'),
        [A.AZURE_AUTH_POLL]: pollBoard('azure'),
        [A.JIRA_AUTH_POLL]: pollBoard('jira')
    };
}
