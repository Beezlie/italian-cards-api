import { findAllMatchingCards } from '../services/scopaService.js';

//TODO - need to enforce the data types here and send proper error on exceptions to client
const gameController = {
    getMatchingCardSets: (request, response) => {
        if (!request.body) {
            throw new ErrorHandler(400, 'Invalid Request');
        }

        const { tableCards, playerCard } = request.body;
        let result = findAllMatchingCards(tableCards, playerCard);

        return response.json({ success: true, result });
    },

    getGameOptions: (request, response) => {
        const result = [
            {
                key: 'scopa', 
                label: 'Scopa',
                numPlayerOptions: [2, 4],
            },
            {
                key: 'scopone', 
                label: 'Scopone',
                numPlayerOptions: [2, 4],
            },
            {
                key: 'briscola', 
                label: 'Briscola',
                numPlayerOptions: [2, 4],
            },
        ];
        return response.json({ success: true, result });
    },
};

export default gameController;
