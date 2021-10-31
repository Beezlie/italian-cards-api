import { Server, Socket } from 'socket.io';
import { Adapter } from 'socket.io-adapter';

export default class ScopaGame {

    constructor(options) {
        /** @type { Server } */
        this.io = options.io; // Shortname for -> io.of('/your_namespace_here')
        /** @type { Socket } */
        this.socket = options.socket;
        this.roomId = options.roomId;
        /** @type { Adapter } */
        this.store = options.io.adapter.rooms.get(this.roomId);

        //Game instance data
        this.store.tableCards = [];
    }

    startGame() {
        consola.info('[GAME START]');
        this.initializeScore();
        this.startGameRound();
    }

    initializeScore() {
        this.store.scores = [];
        const score = {
            teamScore: 0,
            roundScore: {
                cards: 0,
                setteBello: 0,
                dinare: 0,
                sevens: 0,
                scopa: 0,
            }
        }
        for (let i = 0; i < 2; i++) {
            this.store.scores.push(score);
        }
    }

    startGameRound() {
        consola.info('[NEW GAME ROUND]');
        consola.info(this.store.scores);
        consola.info(this.store.players);

        // Create card deck
        let cards = [];
        for (const x of Array(9).keys()) {
            cards.push("s" + (x + 1));
            cards.push("d" + (x + 1));
            cards.push("c" + (x + 1));
            cards.push("b" + (x + 1));
        }
        this.shuffle(cards);

        // Send each player their cards, team and turn
        this.store.tableCards = cards.slice(0, 4);
        for (let i = 1; i <= this.store.players.length; i++) {
            const player = this.store.players[i - 1];
            //TODO - store each player's cards
            const data = {
                tableCards: this.store.tableCards,
                playerHand: cards.slice(4 * i, 4 * (i + 1)),
                scores: this.store.scores,
                team: player.team,
                isPlayerTurn: i === 1,
            };
            if (i === this.store.players.length) {
                this.store.deck = cards.slice(4 * (i + 1), cards.length);
            }
            consola.info(`[PLAYER ${player.id}]`);
            consola.info(data);
            if (player.id !== 'cpu') {
                this.io.to(player.id).emit('start-round', data);
            }
        }
        this.store.numTurnsLeftThisRound = this.store.players.length * 4;
    }

    shuffle(array) {
        // Fisher-Yates shuffle
        let currentIndex = array.length, randomIndex;

        // While there remain elements to shuffle...
        while (currentIndex != 0) {

            // Pick a remaining element...
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex--;

            // And swap it with the current element.
            [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
        }

        return array;
    }

    handlePlayerMove(playerClientId, data) {
        if (playerClientId !== this.store.players[0].id) {
            consola.warn(`[IT IS NOT PLAYER ${playerClientId} TURN]`);
            return;
        }
        const player = this.store.players[0];
        consola.info(`[PLAYER ${player.id} MADE A MOVE]`);
        const nextPlayer = this.store.players[1];

        this.rotatePlayerTurn();
        this.updateRound(player, data);
        if (this.store.numTurnsLeftThisRound === 0) {
            // Round is complete - start new round
            this.updateScoresForNewRound();
            this.startGameRound();
        }

        if (nextPlayer.id === 'cpu') {
            consola.info(`[CPU TURN]`);
            //TODO - need to get all the available moves for the cpu
            // Then pick the best one based on some heuristic
            let availableMoves = [];
        }
    }

    rotatePlayerTurn() {
        this.store.numTurnsLeftThisRound -= 1;
        const lastTurnPlayer = this.store.players.shift();
        this.store.players.push(lastTurnPlayer);
        consola.info(`[NUM TURNS LEFT: ${this.store.numTurnsLeftThisRound}]`);
        consola.info(`[NEXT PLAYER TURN: ${this.store.players[0].id}]`);
    }

    updateRound(player, data) {
        if (data.cardsPickedUp.length) {
            // Player is taking cards from the table
            const playerCards = [...data.cardsPickedUp, data.playerCard];
            this.store.tableCards = this.store.tableCards.filter(function (card) {
                return playerCards.indexOf(card) < 0;
            });
            this.updateRoundScore(player.team, playerCards, this.store.tableCards);
        } else {
            // Player is adding a card from their hand to the table
            this.store.tableCards = [...this.store.tableCards, data.playerCard];
        }

        for (const player of this.store.players) {
            const payload = {
                tableCards: this.store.tableCards,
                scores: this.store.scores,
                isPlayerTurn: this.store.players[0] === player.id,
            };
            consola.info(`[UPDATING GAME FOR PLAYER: ${player.id}]`);
            consola.info(payload);
            if (player.id !== 'cpu') {
                this.io.to(player.id).emit('update-game', payload);
            }
        }
    }

    updateRoundScore(team, playerCards, remainingCards) {
        consola.info(`[UPDATING ROUND SCORE]`);

        let score = this.store.scores[team].roundScore;
        for (const card of playerCards) {
            score.cards++;
            if (card.endsWith('7')) {
                score.sevens++;
                if (card.startsWith('d')) {
                    score.setteBello++;
                }
            }
            if (card.startsWith('d')) {
                score.dinare++;
            }
            if (remainingCards.length === 0) {
                score.scopa++;
            }
        }
        consola.info(this.store.scores);
        this.store.scores[team].roundScore = score;
    }

    updateScoresForNewRound() {
        consola.info(`[UPDATING SCORE FOR COMPLETED ROUND]`);

        const roundScoreFirstTeam = this.store.scores[0].roundScore;
        const roundScoreSecondTeam = this.store.scores[1].roundScore;
        let totalScoreFirstTeam = 0;
        let totalScoreSecondTeam = 0;

        if (roundScoreFirstTeam.cards > roundScoreSecondTeam.cards) {
            totalScoreFirstTeam++;
        } else if (roundScoreSecondTeam.cards > roundScoreFirstTeam.cards) {
            totalScoreSecondTeam++;
        }

        if (roundScoreFirstTeam.sevens > roundScoreSecondTeam.sevens) {
            totalScoreFirstTeam++;
        } else if (roundScoreSecondTeam.sevens > roundScoreFirstTeam.sevens) {
            totalScoreSecondTeam++;
        }

        if (roundScoreFirstTeam.setteBello === 1) {
            totalScoreFirstTeam++;
        } else if (roundScoreSecondTeam.setteBello === 1) {
            totalScoreSecondTeam++;
        }

        if (roundScoreFirstTeam.dinare > roundScoreSecondTeam.dinare) {
            totalScoreFirstTeam++;
        } else if (roundScoreSecondTeam.dinare > roundScoreFirstTeam.dinare) {
            totalScoreSecondTeam++;
        }

        totalScoreFirstTeam += roundScoreFirstTeam.scopa;
        totalScoreSecondTeam += roundScoreSecondTeam.scopa;

        // Update team score
        this.store.scores[0].teamScore = totalScoreFirstTeam;
        this.store.scores[1].teamScore = totalScoreSecondTeam;

        // Reset round score
        for (let i = 0; i < this.store.scores.length; i++) {
            this.store.scores[i].roundScore = {
                cards: 0,
                setteBello: 0,
                dinare: 0,
                sevens: 0,
                scopa: 0,
            };
        }
    }
}
