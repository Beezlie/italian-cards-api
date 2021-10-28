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
        this.store.players = {};
        this.store.deck = [];
        this.store.tableCards = [];
    }

    /**
    * Starts the game
    *
    * @access    public
    */
    startGame() {
        consola.info('[GAME START]');

        //For now randomize teams
        this.initializeScore();

        let cards = [];
        for (const x of Array(9).keys()) {
            cards.push("s" + (x + 1));
            cards.push("d" + (x + 1));
            cards.push("c" + (x + 1));
            cards.push("b" + (x + 1));
        }
        this.shuffle(cards);
        this.store.tableCards = cards.slice(0, 4);
        for (let i = 1; i <= this.store.clients.length; i++) {
            const clientId = this.store.clients[i - 1].id;

            //For now just randomize teams
            const team = i % 2;
            const data = {
                tableCards: this.store.tableCards,
                playerHand: cards.slice(4 * i, 4 * (i + 1)),
                scores: this.store.scores,
                team: team,
            };
            const { tableCards, scores, ...playerData } = data;
            this.store.players[clientId] = playerData;

            if (i === this.store.clients.length) {
                this.store.deck = cards.slice(4 * (i + 1), cards.length);
            }
            this.io.to(clientId).emit('game-start', data);
        }
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

    shuffle(array) {
        //Fisher-Yates shuffle
        let currentIndex = array.length, randomIndex;

        // While there remain elements to shuffle...
        while (currentIndex != 0) {

            // Pick a remaining element...
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex--;

            // And swap it with the current element.
            [array[currentIndex], array[randomIndex]] = [
                array[randomIndex], array[currentIndex]];
        }

        return array;
    }

    listenForPlayerMove() {
        this.socket.on('send-player-move', (data) => {
            consola.info(`[PLAYER MOVE]`);
            this.store.tableCards = this.store.tableCards.filter(function (card) {
                return data.cards.indexOf(card) < 0;
            });

            const team = this.store.players[this.socket.id].team;
            this.updateRoundScore(team, data, this.store.tableCards);
            const payload = {
                tableCards: this.store.tableCards,
                scores: this.store.scores,
            };
            this.io.to(this.roomId).emit('update-game', payload);
        });
    }

    updateRoundScore(team, data, remainingCards) {
        let score = this.store.scores[team].roundScore;
        consola.info(score);
        for (const card of data.cards) {
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
        this.store.scores[team].roundScore = score;
    }
}
