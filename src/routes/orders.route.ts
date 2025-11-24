import { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import { ordersQueue } from '../queue/orderQueue';
import { registerSocketForOrder } from '../ws/wsRegistry';
import { insertOrder } from '../services/orderRepo';
import { getOrder } from '../services/orderRepo';


const TOKEN_ALLOWLIST = new Set(['USDC', 'SOL', 'BONK', 'ETH']);
const MAX_ORDER_AMOUNT = Number(process.env.MAX_ORDER_AMOUNT || 100000);

interface ExecuteOrderRequest {
    tokenIn: string;
    tokenOut: string;
    amount: number;
    side: 'buy' | 'sell';
    type: 'market';
    slippageBps?: number;
    delayMs?: number;
}

export function registerOrderRoutes(app: FastifyInstance) {
    app.post<any>('/api/orders/execute', async (req, reply) => {
        const body = req.body as ExecuteOrderRequest | undefined;

        if (!body || body.type !== 'market' ||
            !body.tokenIn || !body.tokenOut ||
            typeof body.amount !== 'number' || body.amount <= 0 ||
            (body.side !== 'buy' && body.side !== 'sell') ||
            !TOKEN_ALLOWLIST.has(body.tokenIn) || !TOKEN_ALLOWLIST.has(body.tokenOut) ||
            body.amount > MAX_ORDER_AMOUNT
        ) {
            return (reply as any).code(400).send({ error: 'Invalid or disallowed payload' });
        }

        const orderId = randomUUID();

        // persist as pending
        await insertOrder({
            id: orderId,
            token_in: body.tokenIn,
            token_out: body.tokenOut,
            amount: body.amount,
            side: body.side,
            type: 'market'
        });

        const delayMs = Math.max(0, Math.min(body.delayMs ?? 0, 15000)); // cap at 15s for sanity

        await ordersQueue.add(
            'execute',
            { orderId, ...body },
            {
                attempts: 3,
                backoff: { type: 'exponential', delay: 1000 },
                delay: delayMs
            }
        );

        return (reply as any).code(201).send({ orderId });
    });

    app.get<any>('/api/orders/:id', async (req, reply) => {
        const { id } = (req.params as any);
        const row = await getOrder(id);
        if (!row) return (reply as any).code(404).send({ error: 'not_found' });
        return row; // sends full row incl. status_history
    });
    app.register(async function (fastify) {
        fastify.get<any>(
            '/echo',
            { websocket: true } as any,
            (conn: any, req: any) => {
                const ws = conn;

                console.log('WS /echo connected from', req.headers['user-agent']);

                // Send a hello so clients flip to "Connected"
                try { ws.send(JSON.stringify({ event: 'hello', ts: Date.now() })); } catch {}

                ws.on('message', (raw: Buffer) => {
                    const text = raw.toString();
                    console.log('WS /echo msg:', text);
                    try { ws.send(JSON.stringify({ event: 'echo', data: text })); } catch {}
                });

                ws.on('error', (err: any) => {
                    console.log('WS /echo error:', err?.message || err);
                });

                ws.on('close', (code: number, reason: Buffer) => {
                    console.log('WS /echo close:', code, reason?.toString());
                });
            }
        );
    });
    app.register(async function (fastify) {
        fastify.get<any>(
            '/api/orders/execute',
            { websocket: true } as any,
            (connection: any, req: any) => {
                const ws = connection; // ← get the real WebSocket
                console.log('WS /api/orders/execute connected from', req.headers['user-agent']);

                // optional hello
                try { ws.send(JSON.stringify({ event: 'ws_ready', ts: Date.now() })); } catch {}

                ws.on('message', (raw: Buffer) => {                 // ← use ws.on, not connection.on
                    try {
                        const msg = JSON.parse(raw.toString());
                        if (msg && typeof msg.orderId === 'string') {
                            registerSocketForOrder(msg.orderId, ws);
                            const ack = { orderId: msg.orderId, status: 'ws_subscribed' };
                            console.log('WS /api/orders/execute msg:', JSON.stringify(ack));
                            ws.send(JSON.stringify(ack));                 // ← use ws.send, not connection.send
                        } else {
                            ws.send(JSON.stringify({ error: 'invalid_payload' }));
                        }
                    } catch {
                        ws.send(JSON.stringify({ error: 'malformed_json' }));
                    }
                });
            }
        );
    });

}
