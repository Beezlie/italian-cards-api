import bcrypt from 'bcrypt';
import consola from 'consola';
import { Server, Socket } from 'socket.io';
import { Adapter } from 'socket.io-adapter';

import ScopaGame from './scopaGame.js';
import { config } from '../config.js';

const { SALT_ROUNDS, DEFAULT_MAX_PLAYERS, DEFAULT_MAX_TIMER } = config;

export default class Room {
    constructor(options) {
        /** @type { Server } */
        this.io = options.io; // Shortname for -> io.of('/your_namespace_here')
        /** @type { Socket } */
        this.socket = options.socket;
        this.username = options.username;
        this.roomId = options.roomId;
        this.password = options.password; // Optional
        this.action = options.action; // [join, create]
        /** @type { Adapter } */
        this.store = options.io.adapter; // Later expanded to io.adapter.rooms[roomId]
        this.options = {
            maxPlayersLimit: DEFAULT_MAX_PLAYERS,
            maxTimerLimit: DEFAULT_MAX_TIMER,
        };
        if (!options.options) {
            this.options = JSON.parse(options.options);
        }
    }

    /**
     * Initialises steps on first connection.
     *
     * Checks if room available:
     *   If yes, then joins the room
     *   If no, then creates new room.
     *
     * @access    public
     * @return   {bool}    Returns true if initialization is successfull, false otherwise
     */
    async init(username) {
        // Stores an array containing socket ids in 'roomId'
        const clients = await this.io.in(this.roomId).allSockets();
        if (!clients) {
            consola.error('[INTERNAL ERROR] Room creation failed!');
        }

        consola.debug(`Connected Clients are: ${clients}`);

        if (this.action === 'join') {
            // @optional Check if correct password for room
            // Check if room size is equal to or more than 1
            //     If yes, join the socket to the room
            //     If not, emit 'invalid operation: room does not exist'

            this.store = this.store.rooms.get(this.roomId);
            if (clients.size > 0) {
                if (this.store.password && !(await bcrypt.compare(this.password, this.store.password))) {
                    consola.info(`[JOIN FAILED] Incorrect password for room ${this.roomId}`);
                    this.socket.emit('Error: Incorrect password!');
                    return false;
                }

                await this.socket.join(this.roomId);
                this.store.clients.push({ id: this.socket.id, username, isReady: false });
                this.socket.username = username;
                this.socket.emit('[SUCCESS] Successfully initialised', {
                    roomId: this.roomId,
                    password: this.password,
                    options: this.options,
                });
                this.emitRoomUpdate();
                consola.info(`[JOIN] Client joined room ${this.roomId}`);
                return true;
            }

            consola.warn(`[JOIN FAILED] Client denied join, as roomId ${this.roomId} not created`);
            this.socket.emit('Error: Create a room first!');
            return false;
        }

        if (this.action === 'create') {
            // Check if room size is equal to zero
            //     If yes, create new room and join socket to the room
            //     If not, emit 'invalid operation: room already exists'

            if (clients.size === 0) {
                await this.socket.join(this.roomId);
                this.store = this.store.rooms.get(this.roomId);

                if (this.password) {
                    this.store.password = await bcrypt.hash(this.password, SALT_ROUNDS);
                }

                this.store.clients = [{ id: this.socket.id, username, isReady: false }];
                this.store.players = [];
                this.store.gameStarted = false;
                this.store.game = new ScopaGame({
                    io: this.io,
                    socket: this.socket,
                    roomId: this.roomId,
                });

                this.socket.username = username;
                consola.info(`[CREATE] Client created and joined room ${this.roomId}`);
                this.socket.emit('[SUCCESS] Successfully initialised', {
                    roomId: this.roomId,
                    password: this.password,
                    options: this.options,
                });
                this.emitRoomUpdate();
                return true;
            }

            consola.warn(`[CREATE FAILED] Client denied create, as roomId ${this.roomId} already present`);
            this.socket.emit('Error: Room already created. Join the room!');
            return false;
        }
    }

    /**
     * Gracefully disconnect the user from the room
     *
     * @access    public
     */
    onDisconnect() {
        this.socket.on('disconnect', () => {
            try {
                this.store.clients = this.store.clients.filter(player => player.id !== this.socket.id);
                this.emitRoomUpdate();
            } catch {
                consola.info('[FORCE DISCONNECT] Server closed forcefully');
            }
            consola.info(`[PLAYER DISCONNECTED] ${this.socket.username}`);
        });
    }

    /**
     * Mark player as ready  ---> to start the game in the given room. If all players ready then game can be initiated
     *
     * @access public
     */
     isReady() {
        this.socket.on('player-ready', () => {
            for (const player of this.store.clients) {
                if (player.id === this.socket.id) {
                    player.isReady = true;
                    this.emitRoomUpdate();
                }
            }
        });
    }

    /**
     * Update all clients with any state changes of the room or players
     * TODO - how to handle game option state changes when multiple players can update? Maybe only room host can update
     *
     * @access public
     */
    emitRoomUpdate() {
        let playerData = [];
        for (let i = 0; i < this.store.clients.length; i++) {
            playerData.push( { 
                username: this.store.clients[i].username, 
                isReady: this.store.clients[i].isReady,
                isHost: i === 0,
            });
        }
        const payload = {
            players: playerData,
            gameStarted: this.store.gameStarted,
        };
        consola.info(`[UPDATE ROOM DATA] ${payload}`);
        this.io.to(this.roomId).emit('update-room', payload);
    }

    startGame() {
        this.socket.on('start-game', () => {
            const arePlayersReady = this.store.clients.every(player => player.isReady === true);
            if (arePlayersReady && !this.store.gameStarted) {
                this.store.gameStarted = true;
                for (let i = 0; i < this.store.clients.length; i++) {
                    const player = this.store.clients[i];
                    this.store.players.push({
                        id: player.id,
                        name: player.username,
                        team: i % 2,
                    });
                }
                if (this.store.players.length === 1) {
                    this.store.players.push({
                        id: 'cpu',
                        name: 'cpu',
                        team: 1,
                    });
                }
                this.emitRoomUpdate();
                this.store.game.startGame();
            }
        });
    }

    listenForPlayerMoves() {
        this.socket.on('send-player-move', (data) => {
            this.store.game.handlePlayerMove(this.socket.id, data);
        });
    }

    /**
    * Send a message in the game lobby chat
    *
    * @access public
    */
     sendChatMessage() {
        this.socket.on('send-chat-message', (message) => {
            consola.info(`[CHAT MESSAGE] ${message}`);
            const payload = {
                username: this.socket.username,
                type: message.type,
                data: message.data,
            };
            this.io.to(this.roomId).emit('update-chat', payload);
        });
    }
}
