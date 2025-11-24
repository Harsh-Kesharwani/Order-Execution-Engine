import { Queue } from 'bullmq';
import { RedisOptions } from 'ioredis';

const redisOptions: RedisOptions = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT || 6379)
};

export const ordersQueue = new Queue('orders', {
    connection: redisOptions
});
