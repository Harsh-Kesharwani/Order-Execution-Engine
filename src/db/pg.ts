import { Pool } from 'pg';

export const pg = new Pool({
    host: process.env.PG_HOST,
    port: Number(process.env.PG_PORT || 5432),
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    database: process.env.PG_DATABASE,
    max: 10
});

export async function pgPing(): Promise<boolean> {
    try {
        await pg.query('select 1');
        return true;
    } catch (err) {
        console.error('pgPing error:', (err as any)?.message || err);
        return false;
    }
}
