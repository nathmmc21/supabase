-- 1. Create the two tables used by Class Chat Online.
CREATE TABLE IF NOT EXISTS public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  display_name text NOT NULL
    CONSTRAINT profiles_display_name_length
    CHECK (char_length(display_name) BETWEEN 2 AND 24)
);

CREATE TABLE IF NOT EXISTS public.messages (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  content text NOT NULL
    CONSTRAINT messages_content_length
    CHECK (char_length(content) BETWEEN 1 AND 500),
  user_id uuid NOT NULL DEFAULT auth.uid()
    REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Create a profile when Supabase Auth creates a user.
CREATE OR REPLACE FUNCTION public.create_profile_for_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', '')
  );
  RETURN NEW;
END;
$$;

-- A trigger can call this function; browser roles cannot call it directly.
REVOKE ALL PRIVILEGES ON FUNCTION public.create_profile_for_new_user()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_profile_for_new_user();

-- 3. Grant only the table operations used by the app.
REVOKE ALL PRIVILEGES ON TABLE public.profiles, public.messages
  FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON TABLE public.profiles TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.messages TO authenticated;

-- 4. Replace app policies so this script always leaves exactly four.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  existing_policy record;
BEGIN
  FOR existing_policy IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('profiles', 'messages')
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      existing_policy.policyname,
      existing_policy.tablename
    );
  END LOOP;
END;
$$;

CREATE POLICY profiles_select_signed_in
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY messages_select_signed_in
  ON public.messages FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY messages_insert_own
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY messages_delete_own
  ON public.messages FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 5. Add messages to Realtime only when it is not already published.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END;
$$;

-- 6. Reset between class sections only when the instructor chooses to.
-- DELETE FROM public.messages;
