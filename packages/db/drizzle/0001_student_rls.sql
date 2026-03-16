CREATE POLICY "students_read_own_profile" ON "profiles"
  FOR SELECT
  USING (id = auth.uid());
--> statement-breakpoint
CREATE POLICY "students_update_own_profile" ON "profiles"
  FOR UPDATE
  USING (id = auth.uid() AND role = 'student' AND status = 'approved')
  WITH CHECK (id = auth.uid() AND role = 'student' AND status = 'approved');
