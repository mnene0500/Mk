
# QIVO Supabase SQL Setup (Corrected)

To enable the economy, gifting, reporting, and realtime systems, copy and run the following script in your **Supabase SQL Editor**. 

**IMPORTANT**: This script resets your tables to fix type mismatches (UUID vs TEXT) and explicitly grants permissions to resolve "Permission Denied" errors.

```sql
-- 1. RESET TABLES
DROP TABLE IF EXISTS public.users, public.balances, public.coin_history, public.diamond_history, public.processed_payments, public.chats, public.messages, public.agencies, public.withdrawals, public.reports CASCADE;

-- 2. EXTEND USERS TABLE (Strict UUID)
CREATE TABLE public.users (
  uid UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE,
  name TEXT,
  gender TEXT,
  dob DATE,
  country TEXT,
  looking_for TEXT,
  interests TEXT,
  photo_url TEXT,
  additional_photos TEXT[] DEFAULT '{}',
  match_flow_id TEXT UNIQUE,
  onboarding_complete BOOLEAN DEFAULT FALSE,
  is_admin BOOLEAN DEFAULT FALSE,
  is_coin_seller BOOLEAN DEFAULT FALSE,
  is_agent BOOLEAN DEFAULT FALSE,
  is_verified BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
  agency_id TEXT,
  agency_status TEXT, -- 'pending', 'approved', 'rejected'
  check_in_streak INTEGER DEFAULT 0,
  last_check_in_date TIMESTAMPTZ,
  blocking UUID[] DEFAULT '{}',
  blocked_by UUID[] DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. WALLET BALANCES
CREATE TABLE public.balances (
  user_id UUID PRIMARY KEY REFERENCES public.users(uid) ON DELETE CASCADE,
  coins BIGINT DEFAULT 0,
  diamonds NUMERIC DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. COIN LEDGER
CREATE TABLE public.coin_history (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES public.users(uid) ON DELETE CASCADE,
  amount BIGINT,
  type TEXT, -- 'recharge', 'gift_sent', 'chat', 'call', 'bonus', 'task'
  description TEXT,
  timestamp BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)
);

-- 5. DIAMOND LEDGER
CREATE TABLE public.diamond_history (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES public.users(uid) ON DELETE CASCADE,
  amount NUMERIC,
  type TEXT, -- 'gift_received', 'conversion', 'withdrawal'
  description TEXT,
  timestamp BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)
);

-- 6. PAYMENT TRACKING
CREATE TABLE public.processed_payments (
  order_tracking_id TEXT PRIMARY KEY,
  user_id UUID REFERENCES public.users(uid) ON DELETE CASCADE,
  amount NUMERIC,
  coins BIGINT,
  payment_method TEXT,
  timestamp BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)
);

-- 7. CHATS & MESSAGING
CREATE TABLE public.chats (
  id TEXT PRIMARY KEY,
  participant_ids UUID[] NOT NULL,
  last_message TEXT,
  last_message_at BIGINT,
  cleared_at JSONB DEFAULT '{}'::jsonb,
  last_seen_at JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE public.messages (
  id BIGSERIAL PRIMARY KEY,
  chat_id TEXT REFERENCES public.chats(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.users(uid) ON DELETE CASCADE,
  text TEXT,
  timestamp BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000),
  is_gift BOOLEAN DEFAULT FALSE
);

-- 8. AGENCY SYSTEM
CREATE TABLE public.agencies (
  code TEXT PRIMARY KEY,
  agent_uid UUID REFERENCES public.users(uid) ON DELETE CASCADE,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.withdrawals (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES public.users(uid) ON DELETE CASCADE,
  agency_id TEXT REFERENCES public.agencies(code) ON DELETE CASCADE,
  diamonds NUMERIC,
  amount_kes NUMERIC,
  status TEXT DEFAULT 'pending', -- 'pending', 'paid', 'rejected'
  timestamp BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)
);

-- 9. REPORTING SYSTEM
CREATE TABLE public.reports (
  id BIGSERIAL PRIMARY KEY,
  reporter_id UUID REFERENCES public.users(uid) ON DELETE CASCADE,
  reported_id UUID REFERENCES public.users(uid) ON DELETE CASCADE,
  reason TEXT,
  description TEXT,
  proof_photo_url TEXT,
  status TEXT DEFAULT 'pending',
  timestamp BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)
);

-- 10. ENABLE REALTIME REPLICATION
ALTER PUBLICATION supabase_realtime ADD TABLE public.balances;
ALTER PUBLICATION supabase_realtime ADD TABLE public.coin_history;
ALTER PUBLICATION supabase_realtime ADD TABLE public.diamond_history;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chats;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
ALTER PUBLICATION supabase_realtime ADD TABLE public.withdrawals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reports;

-- 11. PERMISSIONS & ROLES
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.balances DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.coin_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.diamond_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.processed_payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.agencies DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports DISABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;
```
