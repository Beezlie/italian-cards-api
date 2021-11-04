import { findAllMatchingCards } from '../services/scopaService';

const gameController = {
    getMatchingCardSets: (request, response) => {
        if (!request.body) {
            throw new ErrorHandler(400, 'Invalid Request');
        }

        const { arr, target } = request.body;
        let result = findAllMatchingCards(arr, target);

        return response.json({ success: true, result });
    },
};

export default gameController;
