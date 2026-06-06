
# QIVO FINAL HARDENED PRODUCTION SQL (v9 - Total Lockdown)

Run this entire script in the **Supabase SQL Editor** to initialize all tables and lock down role-based security, economy, and payouts.

```sql
-- 1. SETUP ATOMIC ECONOMY HELPERS (PROTECTED)
CREATE OR REPLACE FUNCTION public.increment_diamonds(p_user_id UUID, p_amount NUMERIC)
RETURNS VOID AS $$
BEGIN
  -- Security Gate: Only allow Service Role (Admin Key) execution
  IF (current_setting('role') != 'service_role') THEN
    RAISE EXCEPTION 'Security Violation: Direct client-side balance modification is prohibited.';
  END IF;

  INSERT INTO public.balances (user_id, diamonds)
  VALUES (p_user_id, p_amount)
  ON CONFLICT (user_id)
  DO UPDATE SET diamonds = GREATEST(0, COALESCE(balances.diamonds, 0) + p_amount), updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.increment_coins(p_user_id UUID, p_amount BIGINT)
RETURNS VOID AS $$
BEGIN
  -- Security Gate: Only allow Service Role (Admin Key) execution
  IF (current_setting('role') != 'service_role') THEN
    RAISE EXCEPTION 'Security Violation: Direct client-side balance modification is prohibited.';
  END IF;

  INSERT INTO public.balances (user_id, coins)
  VALUES (p_user_id, p_amount)
  ON CONFLICT (user_id)
  DO UPDATE SET coins = GREATEST(0, COALESCE(balances.coins, 0) + p_amount), updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. CREATE CORE TABLES
CREATE TABLE IF NOT EXISTS public.users (
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
  education_level TEXT,
  onboarding_complete BOOLEAN DEFAULT FALSE,
  is_admin BOOLEAN DEFAULT FALSE,
  is_coin_seller BOOLEAN DEFAULT FALSE,
  is_agent BOOLEAN DEFAULT FALSE,
  is_verified BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
  is_dnd BOOLEAN DEFAULT FALSE,
  has_read_receipts BOOLEAN DEFAULT FALSE,
  claimed_verification_reward BOOLEAN DEFAULT FALSE,
  agency_id TEXT,
  agency_status TEXT, 
  check_in_streak INTEGER DEFAULT 0,
  last_check_in_date TIMESTAMPTZ,
  blocking UUID[] DEFAULT '{}',
  blocked_by UUID[] DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ROLE PROTECTION TRIGGER (FIREWALL)
CREATE OR REPLACE FUNCTION public.protect_user_roles()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.is_admin IS DISTINCT FROM NEW.is_admin OR 
      OLD.is_coin_seller IS DISTINCT FROM NEW.is_coin_seller OR 
      OLD.is_agent IS DISTINCT FROM NEW.is_agent) THEN
    
    IF (current_setting('role') != 'service_role') THEN
      RAISE EXCEPTION 'Security Violation: Administrative roles can only be modified by the System.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_protect_user_roles ON public.users;
CREATE TRIGGER tr_protect_user_roles
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.protect_user_roles();

-- 4. OTHER CORE TABLES
CREATE TABLE IF NOT EXISTS public.balances (
  user_id UUID PRIMARY KEY REFERENCES public.users(uid) ON DELETE CASCADE,
  coins BIGINT DEFAULT 0,
  diamonds NUMERIC DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT non_negative_balances CHECK (coins >= 0 AND diamonds >= 0)
);

CREATE TABLE IF NOT EXISTS public.withdrawals (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES public.users(uid) ON DELETE CASCADE,
  agency_id TEXT,
  diamonds NUMERIC,
  amount_kes NUMERIC,
  mpesa_number TEXT,
  status TEXT DEFAULT 'pending', -- pending, paid, rejected
  timestamp BIGINT DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000)
);

-- 5. WITHDRAWAL PROTECTION TRIGGER (FIREWALL)
CREATE OR REPLACE FUNCTION public.protect_withdrawal_status()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.status IS DISTINCT FROM NEW.status) THEN
    IF (current_setting('role') != 'service_role') THEN
      RAISE EXCEPTION 'Security Violation: Payout status can only be modified by the System.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_protect_withdrawal_status ON public.withdrawals;
CREATE TRIGGER tr_protect_withdrawal_status
BEFORE UPDATE ON public.withdrawals
FOR EACH ROW EXECUTE FUNCTION public.protect_withdrawal_status();

-- 6. ENABLE RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

-- 7. POLICIES
DROP POLICY IF EXISTS "Public profiles viewable" ON public.users;
CREATE POLICY "Public profiles viewable" ON public.users FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users update own profile" ON public.users;
CREATE POLICY "Users update own profile" ON public.users FOR UPDATE USING (auth.uid() = uid);

DROP POLICY IF EXISTS "Users view own balance" ON public.balances;
CREATE POLICY "Users view own balance" ON public.balances FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users view own withdrawals" ON public.withdrawals;
CREATE POLICY "Users view own withdrawals" ON public.withdrawals FOR SELECT USING (auth.uid() = user_id);

-- 8. GRANT PERMISSIONS
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;
```
