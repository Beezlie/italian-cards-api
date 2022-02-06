import { Server } from 'socket.io';
import redisAdapter from 'socket.io-redis';
import consola from 'consola';

import { verifyToken } from '../middlewares/index.js';
import { config } from '../config.js';
import Room from './roomManager.js';
import { fixedOrigin } from './corsFixer.js';

const { ALLOWLIST_HOSTS, REDIS_PORT, REDIS_HOST } = config;

const app = app => {
	const io = new Server(app, {
		transports: ['websocket'], // To avoid sticky sessions when using multiple servers
		path: '/classic-mode',
		cors: fixedOrigin(ALLOWLIST_HOSTS),
		rememberUpgrade: true,
	});

	try {
		const adapter = redisAdapter({ host: REDIS_HOST, port: Number(REDIS_PORT) });
		io.adapter(adapter);
	} catch (error) {
		consola.warn('Start redis docker container using `docker-compose up`');
		consola.warn(error);
	}

	consola.info('Socketio initialised!');

	const classicMode = io.of('/classic-mode');
	classicMode.use(verifySocket).on('connection', async socket => {
		consola.info('Socket connection');
		const { username, roomId, password, action, options } = socket.handshake.query;
		const room = new Room({ io: classicMode, socket, username, roomId, password, action, options });
		const joinedRoom = await room.init(username);
		if (joinedRoom) {
			consola.info(`[PLAYER CONNECTED] ${username}`);
			//TODO - need a better way of doing this
			room.isReady();
			room.startGame();
            room.sendChatMessage();
            room.listenForPlayerMoves();
		}

		room.onDisconnect();
	});

	return io;
};

const verifySocket = (socket, next) => {
	if (socket.handshake.query && socket.handshake.query.token) {
		const decoded = verifyToken(socket.handshake.query.token);
		socket.decoded = decoded;
		next();
	}
};

export default app;
