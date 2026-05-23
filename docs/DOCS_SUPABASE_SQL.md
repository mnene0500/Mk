
# QIVO Production SQL (Run in SQL Editor)

```sql
-- 1. SETUP ATOMIC HELPERS (RE-PARAMETERIZED)
CREATE OR REPLACE FUNCTION public.increment_diamonds(user_id UUID, amount NUMERIC)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.balances (user_id, diamonds)
  VALUES (user_id, amount)
  ON CONFLICT (user_id)
  DO UPDATE SET diamonds = balances.diamonds + amount, updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.increment_coins(user_id UUID, amount BIGINT)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.balances (user_id, coins)
  VALUES (user_id, amount)
  ON CONFLICT (user_id)
  DO UPDATE SET coins = balances.coins + amount, updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. CREATE CORE TABLES
CREATE TABLE IF NOT EXISTS public.pending_payments (
  order_id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  amount NUMERIC,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.processed_payments (
  order_tracking_id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  amount NUMERIC,
  coins BIGINT,
  timestamp BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)
);

-- (Other tables remain the same, ensure coins/diamonds columns exist)
```
