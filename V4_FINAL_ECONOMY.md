# V4: Final Hardened Supabase Economy SQL (UUID-based)

-- This script reverts the RPC functions to be based on the user's secure UUID (`uid`),
-- as this is the most direct and secure way to handle transactions.
-- The server-side action will be responsible for looking up the UUID from a given match_flow_id.

-- 1. Drop all previous versions to ensure a clean slate.
DROP FUNCTION IF EXISTS public.increment_coins(user_id UUID, amount BIGINT);
DROP FUNCTION IF EXISTS public.increment_diamonds(user_id UUID, amount NUMERIC);
DROP FUNCTION IF EXISTS public.increment_coins(p_user_id UUID, p_amount BIGINT);
DROP FUNCTION IF EXISTS public.increment_diamonds(p_user_id UUID, p_amount NUMERIC);
DROP FUNCTION IF EXISTS public.increment_coins(p_match_flow_id TEXT, p_amount BIGINT);
DROP FUNCTION IF EXISTS public.increment_diamonds(p_match_flow_id TEXT, p_amount NUMERIC);

-- 2. Re-create the secure `increment_coins` function that accepts a UUID.
CREATE OR REPLACE FUNCTION public.increment_coins(p_user_id UUID, p_amount BIGINT)
RETURNS VOID AS $$
DECLARE
  v_user_exists BOOLEAN;
BEGIN
  -- First, verify the user actually exists.
  SELECT EXISTS(SELECT 1 FROM public.users WHERE uid = p_user_id) INTO v_user_exists;
  IF NOT v_user_exists THEN
    RAISE EXCEPTION 'UserID % not found. Cannot increment coins.', p_user_id;
  END IF;

  -- Atomically insert or update the balance.
  INSERT INTO public.balances (user_id, coins)
  VALUES (p_user_id, p_amount)
  ON CONFLICT (user_id)
  DO UPDATE SET 
    coins = COALESCE(balances.coins, 0) + p_amount, 
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Re-create the corresponding `increment_diamonds` function.
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

    -- Atomically insert or update the balance.
    INSERT INTO public.balances (user_id, diamonds)
    VALUES (p_user_id, p_amount)
    ON CONFLICT (user_id)
    DO UPDATE SET 
        diamonds = COALESCE(balances.diamonds, 0) + p_amount, 
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Grant execute permissions.
GRANT EXECUTE ON FUNCTION public.increment_coins(p_user_id UUID, p_amount BIGINT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.increment_diamonds(p_user_id UUID, p_amount NUMERIC) TO authenticated, anon;


-- HOW TO USE THESE FUNCTIONS --

-- The following snippets are for reference and should be in your application code, not run as SQL.

-- ======================================================================================
-- A. Server-Side (BEST / RECOMMENDED)
-- This is the secure way to call the function, using the Admin client in a server action.
-- ======================================================================================

-- In a server action (`.ts` file), you first look up the user by their `match_flow_id`
-- and then call the RPC function with their secure `uid` (UUID).

-- ```typescript
-- // From src/app/actions/matchflow-actions.ts
-- // ... inside awardCoinsAction

-- // 2. Resolve Recipient by Numeric ID
-- const { data: target, error: targetErr } = await supabase
--   .from('users')
--   .select('uid, name')
--   .eq('match_flow_id', cleanedId)
--   .maybeSingle();

-- // 4. Atomic Award to Recipient using the resolved UUID
-- const { error: awardErr } = await supabaseAdmin.rpc("increment_coins", { p_user_id: target.uid, p_amount: amount });
-- ```

-- ======================================================================================
-- B. Client-Side (DANGEROUS / NOT RECOMMENDED)
-- Calling this RPC from the client is insecure and should be avoided.
-- It would bypass your security checks and expose your database logic.
-- ======================================================================================

-- ```typescript
-- // For demonstration only. Do NOT use this pattern in production for sensitive operations.

-- import { createClient } from '@supabase/supabase-js'

-- const supabase = createClient(
--   process.env.NEXT_PUBLIC_SUPABASE_URL!,
--   process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
-- )

-- async function addCoins() {
--   // This call would FAIL with the current SQL function because it expects a UUID,
--   // but it demonstrates a client-side RPC call.
--   const { data, error } = await supabase.rpc('increment_coins', {
--     p_user_id: 'some-uuid-here', // This must be a valid UUID
--     p_amount: 10
--   })

--   if (error) {
--     console.error(error.message)
--   } else {
--     console.log('This should not be called from the client!')
--   }
-- }
-- ```
