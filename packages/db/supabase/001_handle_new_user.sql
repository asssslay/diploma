-- Automatically create a profile when a new auth user is created.
-- Managed outside Drizzle — apply via Supabase SQL editor or psql.

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
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'student',
    'pending'
  );

  INSERT INTO public.student_profiles (id, "group")
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'group'
  );

  INSERT INTO public.student_applications (id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
