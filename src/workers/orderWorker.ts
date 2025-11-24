import { Worker } from 'bullmq';
import { RedisOptions } from 'ioredis';
import { MockDexRouter } from '../dex/MockDexRouter';
import { appendStatus} from '../services/orderRepo';
import { publishStatus } from '../ws/bus';


const redisOptions: RedisOptions = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT || 6379)
};

const router = new MockDexRouter();

interface OrderJob {
    orderId: string;
    tokenIn: string;
    tokenOut: string;
    amount: number;
    side: 'buy' | 'sell';
    type: 'market';
    slippageBps?: number; // default 100 (1%)
}

function chooseBest(side: 'buy'|'sell', a:{dex:string;price:number}, b:{dex:string;price:number}) {
    if (side === 'buy') return (a.price <= b.price) ? a : b; // want min price to buy
    return (a.price >= b.price) ? a : b;                     // want max price to sell
}

export const worker = new Worker<OrderJob>(
    'orders',
    async (job) => {
        const { orderId, side, slippageBps = 100 } = job.data;

        // (optional) if you didn't already publish 'pending' in POST handler
        publishStatus({orderId, status: 'pending'});
        await appendStatus(orderId, 'pending');

        // ROUTING
        publishStatus({orderId, status: 'routing'});
        await appendStatus(orderId, 'routing');

        const [ray, met] = await Promise.all([
            router.getRaydiumQuote(),
            router.getMeteoraQuote()
        ]);
        const best = chooseBest(side, ray, met);

        console.log(JSON.stringify({
            orderId,
            event: 'routing_decision',
            quotes: { ray, met },
            chosen: best.dex
        }));

        // BUILDING
        publishStatus({orderId, status: 'building', dex: best.dex, quotes: {ray, met}});
        await appendStatus(orderId, 'building', { dex: best.dex });

        // SUBMITTED
        publishStatus({orderId, status: 'submitted', dex: best.dex});
        await appendStatus(orderId, 'submitted');

        // EXECUTE (mock)
        const exec = await router.executeSwap(best.dex as 'raydium' | 'meteora');

        // SLIPPAGE GUARD
        const quotePrice = best.price;
        const maxMove = (slippageBps / 10_000) * quotePrice;
        const violates =
            (side === 'buy'  && exec.executedPrice > quotePrice + maxMove) ||
            (side === 'sell' && exec.executedPrice < quotePrice - maxMove);

        if (violates) {
            const reason = `slippage violated: quote=${quotePrice.toFixed(6)} executed=${exec.executedPrice.toFixed(6)} bps=${slippageBps}`;
            publishStatus({orderId, status: 'failed', error: reason});
            await appendStatus(orderId, 'failed_slippage', {
                failure_reason: reason,
                executed_price: exec.executedPrice
            });
            return;
        }

        // CONFIRMED
        publishStatus({
            orderId,
            status: 'confirmed',
            dex: best.dex,
            txHash: exec.txHash,
            executedPrice: exec.executedPrice
        });
        await appendStatus(orderId, 'confirmed', {
            dex: best.dex,
            tx_hash: exec.txHash,
            executed_price: exec.executedPrice
        });
    },
    { connection: redisOptions, concurrency: 10 }
);

// Final-failure path
worker.on('failed', async (job, err) => {
    if (!job) return;
    const { orderId } = job.data as OrderJob;
    const reason = err?.message || 'unknown error';
    publishStatus({ orderId, status: 'failed', error: reason });
    await appendStatus(orderId, 'failed_permanent', { failure_reason: reason });
});
