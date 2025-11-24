import request from 'supertest';
import { makeTestServer } from '../src/test/testServer';

let server:any, base:string;

beforeAll(async () => {
    server = await makeTestServer(Number(process.env.PORT || 3100));
    base = server.url;
});
afterAll(async () => { await server.close(); });

test('POST /api/orders/execute validates payload', async () => {
    const r = await request(base).post('/api/orders/execute').send({}).set('content-type','application/json');
    expect([400,422]).toContain(r.status);
});

test('POST /api/orders/execute returns 201 + orderId', async () => {
    const r = await request(base).post('/api/orders/execute')
        .send({ tokenIn:'USDC', tokenOut:'SOL', amount:5, side:'buy', type:'market', delayMs: 100 })
        .set('content-type','application/json');
    expect(r.status).toBe(201);
    expect(typeof r.body.orderId).toBe('string');
});
