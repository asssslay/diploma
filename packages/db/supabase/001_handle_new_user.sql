-- Automatically create a profile when a new auth user is created.
-- Managed outside Drizzle — apply via Supabase SQL editor or psql.
--
-- SECURITY DEFINER: bypasses RLS so the trigger can INSERT into
-- tables that have no INSERT policy for the authenticated role.
--
-- ON CONFLICT DO NOTHING: makes the trigger idempotent — safe if
-- Supabase retries the INSERT or the function is re-invoked.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, status)
  VALUES (
    NEW.id,
    NEW.email,
    NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
    'student',
    'pending'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.student_profiles (id, "group")
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'group'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.student_applications (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
