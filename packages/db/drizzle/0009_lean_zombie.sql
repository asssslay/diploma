CREATE TABLE "deadlines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"reminder_email_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deadlines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "deadlines" ADD CONSTRAINT "deadlines_user_id_profiles_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "owner_read_own_deadlines" ON "deadlines" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("deadlines"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "owner_insert_own_deadlines" ON "deadlines" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("deadlines"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "owner_update_own_deadlines" ON "deadlines" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("deadlines"."user_id" = (select auth.uid())) WITH CHECK ("deadlines"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "owner_delete_own_deadlines" ON "deadlines" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("deadlines"."user_id" = (select auth.uid()));