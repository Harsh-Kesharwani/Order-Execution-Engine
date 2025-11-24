import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { registerOrderRoutes } from '../routes/orders.route';
import { onStatus } from '../ws/bus';
import { emitStatus } from '../ws/wsRegistry';

export async function makeTestServer(port: number) {
    const app = Fastify({ logger: false });
    app.register(websocket);
    onStatus((msg) => msg?.orderId && emitStatus(msg.orderId, msg));
    app.register(async (fastify) => {
        registerOrderRoutes(fastify);
    });
    await app.listen({ port, host: '127.0.0.1' });
    return {
        app,
        url: `http://127.0.0.1:${port}`,
        ws: `ws://127.0.0.1:${port}`,
        close: () => app.close()
    };
}
