import { findAllMatchingCards } from '../services/scopaService.js';

const gameController = {
    getMatchingCardSets: (request, response) => {
        if (!request.body) {
            throw new ErrorHandler(400, 'Invalid Request');
        }

        //TODO - need to enforce the data types here and send proper error on exceptions to client
        const { tableCards, playerCard } = request.body;
        let result = findAllMatchingCards(tableCards, playerCard);

        return response.json({ success: true, result });
    },
};

export default gameController;
