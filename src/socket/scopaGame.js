import { Server, Socket } from 'socket.io';
import { Adapter } from 'socket.io-adapter';

import { findHighestScoringMove } from '../services/scopaService.js';

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
        for (let i = 0; i < 2; i++) {
            this.store.scores.push({
                teamScore: 0,
                roundScore: {
                    cards: 0,
                    setteBello: 0,
                    dinare: 0,
                    sevens: 0,
                    scopa: 0,
                }
            });
        }
    }

    startGameRound() {
        consola.info('[NEW GAME ROUND]');
        consola.info(this.store.scores);
        consola.info(this.store.players);

        // Create card deck - 40 cards total, 10 each suit
        let cards = [];
        for (const x of Array(10).keys()) {
            cards.push("s" + (x + 1));
            cards.push("d" + (x + 1));
            cards.push("c" + (x + 1));
            cards.push("b" + (x + 1));
        }
        this.shuffle(cards);
        this.store.tableCards = cards.slice(0, 4);
        this.store.deck = cards.slice(4, cards.length);

        // Initialize game data
        for (let i = 0; i < this.store.players.length; i++) {
            const player = this.store.players[i];
            const data = {
                scores: this.store.scores,
                team: player.team,
                isPlayerTurn: i === 0,
            };
            consola.info(data);
            this.emitDataToPlayer('start-round', data, player.id);
        }
        this.dealCards();
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

    dealCards() {
        consola.info(`[DECK BEFORE DEAL: COUNT=[${this.store.deck.length}], CARDS=[${this.store.deck}]]`);
        for (let i = 0; i < this.store.players.length; i++) {
            const player = this.store.players[i];
            //TODO - store each player's cards in a neater way
            this.store.players[i].cards = this.store.deck.slice(3 * i, 3 * (i + 1));

            const data = {
                tableCards: this.store.tableCards,
                playerHand: this.store.deck.slice(3 * i, 3 * (i + 1)),
                deckCount: this.store.deck.length - this.store.players.length * 3,
            };
            consola.info(data);
            this.emitDataToPlayer('deal-cards', data, player.id);
        }
        this.store.deck = this.store.deck.slice(3 * this.store.players.length, this.store.deck.length);
        consola.info(`[DECK AFTER DEAL: COUNT=[${this.store.deck.length}], CARDS=[${this.store.deck}]]`);
    }

    handlePlayerMove(playerClientId, data) {
        if (playerClientId !== this.store.players[0].id) {
            consola.warn(`[IT IS NOT PLAYER ${playerClientId} TURN]`);
            return;
        }
        const player = this.store.players[0];
        consola.info(`[PLAYER ${player.id} MADE A MOVE]`);
        const nextPlayer = this.store.players[1];

        this.completeTurn(player, data.playerCard, data.cardsPickedUp);
        if (nextPlayer.id === 'cpu') {
            this.handleCPUMove(nextPlayer);
        }
    }

    handleCPUMove(cpuPlayer) {
        consola.info(`[CPU TURN]`);

        //Sleep
        var now = new Date().getTime();
        while (new Date().getTime() < now + 2000) { /* Do nothing */ }

        let bestMove = findHighestScoringMove(this.store.tableCards, cpuPlayer.cards);
        if (Object.keys(bestMove).length === 0) {
            bestMove = {
                card: cpuPlayer.cards[0],
                matches: [],
            };
        }
        consola.info(`[CPU CARDS ${cpuPlayer.cards}]`);
        consola.info(`[AVAILABLE CARDS ${this.store.tableCards}]`);
        consola.info(`[CPU PLAYED ${bestMove.card} AND TOOK CARDS ${bestMove.matches}]`);
        this.completeTurn(cpuPlayer, bestMove.card, bestMove.matches);
    }

    completeTurn(player, cardPlayed, cardsTaken) {
        // Rotate the player who's turn it is
        const lastTurnPlayer = this.store.players.shift();
        this.store.players.push(lastTurnPlayer);
        consola.info(`[NEXT PLAYER TURN: ${this.store.players[0].id}]`);

        this.updateGameStateAfterTurn(player, cardPlayed, cardsTaken);
        this.redistributeCardsIfNeeded();

        if (this.store.deck.length === 0 && this.playerHandsAreEmpty()) {
            // Round is complete - start new round
            if (this.store.tableCards.length) {
                // Give rest of table cards to last user who picked up cards
                //TODO - this should have an associated animation
                this.updateScore(this.store.lastPlayerToTakeCards.team, this.store.tableCards, this.store.tableCards);
            }
            this.updateScoresForNewRound();
            this.startGameRound();
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

    updateGameStateAfterTurn(player, playerCard, cardsPickedUp) {
        // Remove played card from player hand
        player.cards = player.cards.filter(card => card !== playerCard);

        if (cardsPickedUp.length) {
            // Player is taking cards from the table
            this.store.lastPlayerToTakeCards = player;
            const playerCards = [...cardsPickedUp, playerCard];
            this.store.tableCards = this.store.tableCards.filter(function (card) {
                return playerCards.indexOf(card) < 0;
            });
            this.updateScore(player.team, playerCards, this.store.tableCards);
        } else {
            // Player is adding a card from their hand to the table
            this.store.tableCards = [...this.store.tableCards, playerCard];
        }

        for (const player of this.store.players) {
            const data = {
                cardPlayed: playerCard,
                cardsPickedUp: cardsPickedUp,
                isPlayerTurn: this.store.players[0].id === player.id,
            };
            this.emitDataToPlayer('update-after-turn', data, player.id);
        }
    }

    redistributeCardsIfNeeded() {
        // Only Re-deal cards once players' hands are empty
        if (!this.playerHandsAreEmpty()) {
            return;
        }

        if (this.store.deck.length !== 0) {
            // Deal players cards from deck
            this.dealCards();
        }
    }

    playerHandsAreEmpty() {
        const playersWithCards = this.store.players.filter(function (player) {
            return player.cards.length !== 0;
        });
        return playersWithCards.length === 0;
    }

    emitDataToPlayer(eventName, data, playerId) {
        consola.info(`[SENDING DATA TO PLAYER ${playerId} FOR EVENT ${eventName}]`);
        if (playerId !== 'cpu') {
            this.io.to(playerId).emit(eventName, data);
        }
    }

    updateScore(team, playerCards, remainingCards) {
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
        }
        if (remainingCards.length === 0) {
            score.scopa++;
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
        this.store.scores[0].teamScore += totalScoreFirstTeam;
        this.store.scores[1].teamScore += totalScoreSecondTeam;
    }
}
