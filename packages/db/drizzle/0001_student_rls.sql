-- Students can update their own profile (only approved students)
CREATE POLICY "students_update_own_profile" ON "profiles"
  FOR UPDATE
  USING (id = auth.uid() AND role = 'student' AND status = 'approved')
  WITH CHECK (id = auth.uid() AND role = 'student' AND status = 'approved');
