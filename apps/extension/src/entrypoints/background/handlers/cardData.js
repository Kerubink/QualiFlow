import { RuntimeActions } from '../../../contracts/runtimeActions.js';
import { getCardData, getBoardTags } from '../../../application/cardData.js';

export function createCardDataHandlers(deps) {
    return {
        [RuntimeActions.GET_DATA]: async (request) => ({
            data: await getCardData({ workId: request.workId, provider: request.provider }, deps)
        }),
        [RuntimeActions.GET_BOARD_TAGS]: async () => ({ data: await getBoardTags(deps) })
    };
}
