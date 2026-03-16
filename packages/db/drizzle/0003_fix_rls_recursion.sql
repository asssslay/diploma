CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;
--> statement-breakpoint
DROP POLICY IF EXISTS "admins_read_all_profiles" ON "profiles";
--> statement-breakpoint
DROP POLICY IF EXISTS "admins_update_profiles" ON "profiles";
--> statement-breakpoint
CREATE POLICY "admins_read_all_profiles" ON "profiles"
  FOR SELECT
  USING (public.is_admin());
--> statement-breakpoint
CREATE POLICY "admins_update_profiles" ON "profiles"
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
