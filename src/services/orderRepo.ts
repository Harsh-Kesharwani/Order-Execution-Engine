import { pg } from '../db/pg';

export type OrderStatus =
    | 'pending' | 'routing' | 'building' | 'submitted'
    | 'confirmed'
    | 'failed_slippage' | 'failed_permanent';

export interface NewOrderRow {
    id: string;
    token_in: string;
    token_out: string;
    amount: number;
    side: 'buy' | 'sell';
    type: 'market';
}

export async function insertOrder(row: NewOrderRow) {
    const { id, token_in, token_out, amount, side, type } = row;
    await pg.query(
        `INSERT INTO orders (id, token_in, token_out, amount, side, type, status, status_history)
     VALUES ($1,$2,$3,$4,$5,$6,'pending', $7::jsonb)`,
        [id, token_in, token_out, amount, side, type, JSON.stringify([{ ts: Date.now(), status: 'pending' }])]
    );
}

export async function appendStatus(
    id: string,
    status: OrderStatus,
    patch: Record<string, any> = {}
) {
    const historyEvent = { ts: Date.now(), status, ...patch };

    // Start with fixed pieces
    const sets: string[] = [
        `status = $1`,
        `status_history = status_history || $2::jsonb`
    ];
    const params: any[] = [status, JSON.stringify([historyEvent])];

    // Helper to push a column update with the next placeholder
    const pushSet = (col: string, val: any) => {
        sets.push(`${col} = $${params.length + 1}`);
        params.push(val);
    };

    if (patch.dex !== undefined) pushSet('dex', patch.dex);
    if (patch.tx_hash !== undefined) pushSet('tx_hash', patch.tx_hash);
    if (patch.executed_price !== undefined) pushSet('executed_price', patch.executed_price);
    if (patch.failure_reason !== undefined) pushSet('failure_reason', patch.failure_reason);

    // WHERE id = $N  (N = params.length + 1)
    params.push(id);
    const whereIdx = params.length;

    const sql = `UPDATE orders SET ${sets.join(', ')} WHERE id = $${whereIdx}`;
    await pg.query(sql, params);
}


export async function getOrder(id: string) {
    const r = await pg.query('SELECT * FROM orders WHERE id=$1', [id]);
    return r.rows[0] || null;
}
