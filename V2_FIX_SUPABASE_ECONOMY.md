
# V2: Hardened Supabase Economy SQL

-- This script provides atomic, safe RPC functions for managing user balances.
-- It adds crucial checks and improves error handling.

-- 1. Drop old functions to ensure a clean slate.
DROP FUNCTION IF EXISTS public.increment_coins(user_id UUID, amount BIGINT);
DROP FUNCTION IF EXISTS public.increment_diamonds(user_id UUID, amount NUMERIC);

-- 2. Create the new, more robust `increment_coins` function.
--    - Uses `SECURITY DEFINER` to run with elevated privileges.
--    - Validates that the user exists before attempting a transaction.
--    - Raises a specific, clear exception if the user is not found.
--    - Renamed parameters (p_user_id, p_amount) to avoid conflicts.
CREATE OR REPLACE FUNCTION public.increment_coins(p_user_id UUID, p_amount BIGINT)
RETURNS VOID AS $$
DECLARE
  v_user_exists BOOLEAN;
BEGIN
  -- Verify the user exists in the public.users table.
  SELECT EXISTS(SELECT 1 FROM public.users WHERE uid = p_user_id) INTO v_user_exists;
  IF NOT v_user_exists THEN
    RAISE EXCEPTION 'UserID % not found. Cannot increment coins.', p_user_id;
  END IF;

  -- Atomically insert a new balance record or update an existing one.
  -- The ON CONFLICT clause makes this operation safe for concurrent transactions.
  INSERT INTO public.balances (user_id, coins)
  VALUES (p_user_id, p_amount)
  ON CONFLICT (user_id)
  DO UPDATE SET 
    coins = COALESCE(balances.coins, 0) + p_amount, 
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Create the corresponding `increment_diamonds` function for consistency.
CREATE OR REPLACE FUNCTION public.increment_diamonds(p_user_id UUID, p_amount NUMERIC)
RETURNS VOID AS $$
DECLARE
    v_user_exists BOOLEAN;
BEGIN
    -- Verify the user exists.
    SELECT EXISTS(SELECT 1 FROM public.users WHERE uid = p_user_id) INTO v_user_exists;
    IF NOT v_user_exists THEN
        RAISE EXCEPTION 'UserID % not found. Cannot increment diamonds.', p_user_id;
    END IF;

    -- Atomically insert or update the diamond balance.
    INSERT INTO public.balances (user_id, diamonds)
    VALUES (p_user_id, p_amount)
    ON CONFLICT (user_id)
    DO UPDATE SET 
        diamonds = COALESCE(balances.diamonds, 0) + p_amount, 
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. Add database-level checks to prevent negative balances.
-- This acts as a final safeguard against bugs in the application logic,
-- ensuring the integrity of your economy.

-- First, remove any old constraints to avoid conflicts.
ALTER TABLE public.balances DROP CONSTRAINT IF EXISTS non_negative_balances;

-- Add a CHECK constraint to enforce that coins and diamonds can never be less than zero.
ALTER TABLE public.balances ADD CONSTRAINT non_negative_balances 
CHECK (coins >= 0 AND diamonds >= 0);

-- 5. Grant permissions for the new functions to the necessary roles.
GRANT EXECUTE ON FUNCTION public.increment_coins(p_user_id UUID, p_amount BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_diamonds(p_user_id UUID, p_amount NUMERIC) TO authenticated;


-- Reminder on Schema Consistency:
-- users.uid should be type UUID and PRIMARY KEY.
-- balances.user_id should be type UUID and a FOREIGN KEY to users.uid.
-- Your existing schema already follows this best practice. No changes are needed there.
--
-- CREATE TABLE IF NOT EXISTS public.users (
--   uid UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
--   ...
-- );
--
-- CREATE TABLE IF NOT EXISTS public.balances (
--   user_id UUID PRIMARY KEY REFERENCES public.users(uid) ON DELETE CASCADE,
--   coins BIGINT DEFAULT 0,
--   diamonds NUMERIC DEFAULT 0,
--   ...
-- );

