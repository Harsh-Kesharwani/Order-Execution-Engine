import 'dotenv/config';
import { worker } from '../src/workers/orderWorker';

beforeAll(async () => {
    // @ts-ignore waitUntilReady exists on Worker
    if ((worker as any).waitUntilReady) {
        await (worker as any).waitUntilReady();
    }
});

afterAll(async () => {
    try { await worker.close(); } catch {}
});
