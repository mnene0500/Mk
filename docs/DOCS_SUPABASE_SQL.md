
# QIVO Production SQL (Run in SQL Editor)

This script sets up all tables and the **CRITICAL** storage RLS policies for your buckets.

```sql
-- 1. SETUP ATOMIC HELPERS
CREATE OR REPLACE FUNCTION public.increment_diamonds(user_id UUID, amount NUMERIC)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.balances (user_id, diamonds)
  VALUES (user_id, amount)
  ON CONFLICT (user_id)
  DO UPDATE SET diamonds = balances.diamonds + amount, updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.increment_coins(user_uid UUID, amount BIGINT)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.balances (user_id, coins)
  VALUES (user_uid, amount)
  ON CONFLICT (user_id)
  DO UPDATE SET coins = balances.coins + amount, updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. CORE TABLES (IF NOT ALREADY CREATED)
-- [Run table creation from earlier docs if starting from scratch]

-- 3. ENABLE RLS FOR STORAGE BUCKETS
-- Profile Photos (Public read, Private write)
CREATE POLICY "Public Read Profile Photos" ON storage.objects FOR SELECT USING (bucket_id = 'profile-photos');
CREATE POLICY "Users can upload own profile photo" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'profile-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can update own profile photo" ON storage.objects FOR UPDATE USING (bucket_id = 'profile-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Post Photos (Public read, Private write)
CREATE POLICY "Public Read Post Photos" ON storage.objects FOR SELECT USING (bucket_id = 'post-photos');
CREATE POLICY "Users can upload own post photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'post-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can delete own post photos" ON storage.objects FOR DELETE USING (bucket_id = 'post-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 4. REPORT SYSTEM RLS
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can create reports" ON public.reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Admins can view all reports" ON public.reports FOR SELECT USING (EXISTS (SELECT 1 FROM public.users WHERE uid = auth.uid() AND is_admin = true));
CREATE POLICY "Admins can update reports" ON public.reports FOR UPDATE USING (EXISTS (SELECT 1 FROM public.users WHERE uid = auth.uid() AND is_admin = true));

-- 5. RE-ENABLE REALTIME
ALTER PUBLICATION supabase_realtime ADD TABLE public.balances, public.coin_history, public.diamond_history, public.chats, public.messages, public.users, public.reports;
```
