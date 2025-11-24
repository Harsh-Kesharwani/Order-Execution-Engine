CREATE TABLE IF NOT EXISTS orders (
                                      id UUID PRIMARY KEY,
                                      token_in TEXT NOT NULL,
                                      token_out TEXT NOT NULL,
                                      amount NUMERIC NOT NULL,
                                      side TEXT NOT NULL,         -- 'buy' | 'sell'
                                      type TEXT NOT NULL,         -- 'market'
                                      dex TEXT,
                                      status TEXT NOT NULL,       -- pending/routing/building/submitted/confirmed/failed_*
                                      tx_hash TEXT,
                                      executed_price NUMERIC,
                                      failure_reason TEXT,
                                      status_history JSONB NOT NULL DEFAULT '[]'::jsonb,
                                      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_orders ON orders;
CREATE TRIGGER trg_touch_orders
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE PROCEDURE touch_updated_at();
