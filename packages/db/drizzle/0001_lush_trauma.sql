CREATE TABLE "student_applications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"rejection_reason" text
);
--> statement-breakpoint
ALTER TABLE "student_applications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "student_applications" ADD CONSTRAINT "student_applications_id_profiles_fk" FOREIGN KEY ("id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_applications" ADD CONSTRAINT "student_applications_reviewed_by_profiles_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "admins_read_all_applications" ON "student_applications" AS PERMISSIVE FOR SELECT TO "authenticated" USING (public.is_admin());--> statement-breakpoint
CREATE POLICY "students_read_own_application" ON "student_applications" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("student_applications"."id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "admins_update_applications" ON "student_applications" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (public.is_admin()) WITH CHECK (public.is_admin());