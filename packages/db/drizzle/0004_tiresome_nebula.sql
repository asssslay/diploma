CREATE TABLE "event_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"registered_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_registrations_event_student_unique" UNIQUE("event_id","student_id")
);
--> statement-breakpoint
ALTER TABLE "event_registrations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"image_url" text,
	"author_id" uuid,
	"event_date" timestamp with time zone NOT NULL,
	"location" text NOT NULL,
	"max_participants" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_event_id_events_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_student_id_profiles_fk" FOREIGN KEY ("student_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_author_id_profiles_fk" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "admins_read_all_registrations" ON "event_registrations" AS PERMISSIVE FOR SELECT TO "authenticated" USING (public.is_admin());--> statement-breakpoint
CREATE POLICY "students_read_own_registrations" ON "event_registrations" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("event_registrations"."student_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "students_insert_own_registration" ON "event_registrations" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("event_registrations"."student_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "students_delete_own_registration" ON "event_registrations" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("event_registrations"."student_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "admins_manage_events" ON "events" AS PERMISSIVE FOR SELECT TO "authenticated" USING (public.is_admin());--> statement-breakpoint
CREATE POLICY "authenticated_read_events" ON "events" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "admins_insert_events" ON "events" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (public.is_admin());--> statement-breakpoint
CREATE POLICY "admins_update_events" ON "events" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (public.is_admin()) WITH CHECK (public.is_admin());