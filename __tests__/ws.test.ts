import WebSocket from 'ws';
import request from 'supertest';
import { makeTestServer } from '../src/test/testServer';

let server:any, base:string, wsb:string;

beforeAll(async () => {
    server = await makeTestServer(Number(process.env.PORT || 3100));
    base = server.url; wsb = server.ws;
});
afterAll(async () => { await server.close(); });

function waitMsg(ws: WebSocket, timeout=5000): Promise<any> {
    return new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('timeout')), timeout);
        ws.once('message', (raw) => {
            clearTimeout(t);
            try { resolve(JSON.parse(raw.toString())); } catch { resolve(raw.toString()); }
        });
        ws.once('error', reject);
    });
}

test('WS subscribe ack', async () => {
    const post = await request(base).post('/api/orders/execute')
        .send({ tokenIn:'USDC', tokenOut:'SOL', amount:1, side:'buy', type:'market', delayMs: 500 })
        .set('content-type','application/json');
    const orderId = post.body.orderId;

    const ws = new WebSocket(`${wsb}/api/orders/execute`);
    await new Promise(res => ws.on('open', res));
    ws.send(JSON.stringify({ orderId }));
    const ack = await waitMsg(ws, 3000);
    expect(ack.status).toBe('ws_subscribed');
    ws.close();
});

test('WS receives at least one status after subscribe', async () => {
    const post = await request(base).post('/api/orders/execute')
        .send({ tokenIn:'USDC', tokenOut:'SOL', amount:1, side:'buy', type:'market', delayMs: 1500 })
        .set('content-type','application/json');
    const orderId = post.body.orderId;

    const ws = new WebSocket(`${wsb}/api/orders/execute`);
    await new Promise(res => ws.on('open', res));
    ws.send(JSON.stringify({ orderId }));

    // first message is ack; second should be a status (pending/routing/...)
    await waitMsg(ws, 3000);
    const status = await waitMsg(ws, 5000);
    expect(['pending','routing','building','submitted','confirmed','failed']).toContain(status.status);
    ws.close();
});
