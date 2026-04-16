ALTER TABLE "user_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "notify_deadline_reminders" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "notify_event_reminders" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_id_profiles_fk" FOREIGN KEY ("id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "owner_read_own_settings" ON "user_settings" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("user_settings"."id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "owner_insert_own_settings" ON "user_settings" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("user_settings"."id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "owner_update_own_settings" ON "user_settings" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("user_settings"."id" = (select auth.uid())) WITH CHECK ("user_settings"."id" = (select auth.uid()));