import { RuntimeActions as A } from '../../../contracts/runtimeActions.js';
import { evaluateCoverage } from '../../../application/coverage.js';
import { listModels } from '../../../application/aiModels.js';

export function createAiHandlers(deps) {
    return {
        [A.EVALUATE_COVERAGE]: async (r) => ({ result: await evaluateCoverage({ cardData: r.cardData }, deps) }),
        [A.GET_GROQ_MODELS]: async () => ({ models: await listModels('groq', deps) }),
        [A.GET_GEMINI_MODELS]: async () => ({ models: await listModels('gemini', deps) }),
        [A.GET_COPILOT_MODELS]: async () => ({ models: await listModels('copilot', deps) })
    };
}
