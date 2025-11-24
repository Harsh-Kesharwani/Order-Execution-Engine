// src/ws/bus.ts
import Redis from 'ioredis';

const host = process.env.REDIS_HOST || '127.0.0.1';
const port = Number(process.env.REDIS_PORT || 6379);

export const pub = new Redis({ host, port });
export const sub = new Redis({ host, port });

const CHANNEL = 'order_status';

export function publishStatus(payload: any) {
    console.log("publish: "+JSON.stringify(payload))
    pub.publish(CHANNEL, JSON.stringify(payload));
}

export function onStatus(handler: (msg: any) => void) {
    sub.subscribe(CHANNEL, (err) => {
        if (err) { console.error('[bus:sub] subscribe error:', err?.message); return; }
        console.log('[bus:sub] subscribed to', CHANNEL);
    });
    sub.on('message', (_chan, raw) => {
        try {
            const msg = JSON.parse(raw);
            console.log('[bus:sub] recv ←', msg);                    // 👈 loud log
            handler(msg);
        } catch (e) {
            console.error('[bus:sub] parse error:', (e as any)?.message, 'raw=', raw);
        }
    });
}
