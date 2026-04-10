CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_user_id_profiles_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "owner_read_own_notes" ON "notes" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("notes"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "owner_insert_own_notes" ON "notes" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("notes"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "owner_update_own_notes" ON "notes" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("notes"."user_id" = (select auth.uid())) WITH CHECK ("notes"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "owner_delete_own_notes" ON "notes" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("notes"."user_id" = (select auth.uid()));