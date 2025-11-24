import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import cors from '@fastify/cors';
import {registerOrderRoutes} from './routes/orders.route';
import { pgPing } from './db/pg';
import { onStatus } from './ws/bus';
import { emitStatus } from './ws/wsRegistry';
import { ordersQueue } from './queue/orderQueue';
import IORedis from 'ioredis';
async function waitForPg(retries = 10) {
    for (let i = 0; i < retries; i++) {
        if (await pgPing()) return true;
        await new Promise(r => setTimeout(r, 1000));
    }
    return false;
}
async function bootstrap() {
    if (!(await waitForPg())) {
        console.error('Postgres not reachable; check env / docker-compose');
        process.exit(1);
    }

    const app = Fastify({logger: true});

    app.register(cors, {origin: true});
    app.register(websocket);
    const r = new IORedis({host: process.env.REDIS_HOST || '127.0.0.1', port: Number(process.env.REDIS_PORT || 6379)});
    app.get('/health', async (_req, reply) => {
        const [dbOk, redisOk, q] = await Promise.all([
            pgPing(),
            r.ping().then(x => x === 'PONG').catch(() => false),
            ordersQueue.getWaitingCount().catch(() => -1)
        ]);
        const ok = dbOk && redisOk && q >= 0;
        return (reply as any).code(ok ? 200 : 500).send({db: dbOk, redis: redisOk, queueDepth: q});
    });
    registerOrderRoutes(app);
    onStatus((msg) => {
        if (!msg?.orderId) return;
        console.log('[relay] emitStatus →', msg.orderId, msg);       // 👈 loud log
        emitStatus(msg.orderId, msg);
    });

    const PORT = Number(process.env.PORT || 3000);
    await app.listen({port: Number(process.env.PORT || 3000), host: '::'});
    console.log(`API on http://localhost:${PORT}`);


}
bootstrap().catch((e) => {
    console.error(e);
    process.exit(1);
})
