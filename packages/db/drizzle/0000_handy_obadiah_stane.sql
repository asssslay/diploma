CREATE TYPE "public"."user_role" AS ENUM('admin', 'student');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"full_name" text,
	"role" "user_role" DEFAULT 'student' NOT NULL,
	"status" "user_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "student_profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"faculty" text,
	"group" text,
	"avatar_url" text,
	"background_url" text,
	"bio" text,
	"interests" text[] DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "student_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_auth_users_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_id_profiles_fk" FOREIGN KEY ("id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "admins_read_all_profiles" ON "profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING (public.is_admin());--> statement-breakpoint
CREATE POLICY "users_read_own_profile" ON "profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("profiles"."id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "admins_update_profiles" ON "profiles" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (public.is_admin()) WITH CHECK (public.is_admin());--> statement-breakpoint
CREATE POLICY "students_update_own_profile" ON "profiles" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("profiles"."id" = (select auth.uid()) AND "profiles"."role" = 'student' AND "profiles"."status" = 'approved') WITH CHECK ("profiles"."id" = (select auth.uid()) AND "profiles"."role" = 'student' AND "profiles"."status" = 'approved');--> statement-breakpoint
CREATE POLICY "authenticated_read_student_profiles" ON "student_profiles" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "admins_update_student_profiles" ON "student_profiles" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (public.is_admin()) WITH CHECK (public.is_admin());--> statement-breakpoint
CREATE POLICY "students_update_own_student_profile" ON "student_profiles" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("student_profiles"."id" = (select auth.uid())) WITH CHECK ("student_profiles"."id" = (select auth.uid()));