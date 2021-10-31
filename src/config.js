/* eslint-disable operator-linebreak */
import dotenv from 'dotenv';
dotenv.config();

function getDefault(value, defaultValue) {
    if (!value || value === 'undefined') {
        return defaultValue;
    }

    return value;
}

const productionHosts = [];
const devHosts = ['http://localhost:3000', 'http://192.168.1.131:3000'];

export const config = {
    IS_DEVELOPMENT: getDefault(process.env.NODE_ENV, 'development') !== 'production',

    DB_URL: getDefault(process.env.DB_URL, 'mongodb://localhost:27017/italian-cards-db'),
    JWT_SECRET: getDefault(process.env.JWT_SECRET, 'REDACTED'),
    API_PORT: process.env.API_PORT ? Number.parseInt(process.env.API_PORT, 10) : 8080,
    SOCKET_PORT: process.env.SOCKET_PORT ? Number.parseInt(process.env.SOCKET_PORT, 10) : 65080,
    REDIS_PORT: process.env.REDIS_PORT ? Number.parseInt(process.env.REDIS_PORT, 10) : 6379,
    REDIS_HOST: getDefault(process.env.REDIS_HOST, 'localhost'),

    SALT_ROUNDS: process.env.SALT_ROUNDS ? Number.parseInt(process.env.SALT_ROUNDS, 10) : 6,
    DEFAULT_MAX_TIMER: 120 * 1000,
    DEFAULT_MAX_PLAYERS: 2,

    ALLOWLIST_HOSTS: getDefault(process.env.NODE_ENV, 'development') === 'production' ? productionHosts : devHosts,

    ROOM_ID_RX: /^([A-Z\d]){6}$/,
};
