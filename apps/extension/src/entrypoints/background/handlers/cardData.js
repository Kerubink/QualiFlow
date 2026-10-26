import { RuntimeActions } from '../../../contracts/runtimeActions.js';
import { getCardData } from '../../../application/cardData.js';

export function createCardDataHandlers(deps) {
    return {
        [RuntimeActions.GET_DATA]: async (request) => ({
            data: await getCardData({ workId: request.workId, provider: request.provider }, deps)
        })
    };
}
