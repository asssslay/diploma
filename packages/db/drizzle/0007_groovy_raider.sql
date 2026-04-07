CREATE TYPE "public"."discussion_category" AS ENUM('general', 'academic', 'social', 'help', 'feedback');--> statement-breakpoint
CREATE TABLE "comment_reactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"comment_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text DEFAULT 'like' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comment_reactions_unique" UNIQUE("comment_id","user_id","type")
);
--> statement-breakpoint
ALTER TABLE "comment_reactions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "discussion_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discussion_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "discussion_comments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "discussion_reactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"discussion_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text DEFAULT 'like' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "discussion_reactions_unique" UNIQUE("discussion_id","user_id","type")
);
--> statement-breakpoint
ALTER TABLE "discussion_reactions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "discussions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"category" "discussion_category" NOT NULL,
	"author_id" uuid NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "discussions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "comment_reactions" ADD CONSTRAINT "comment_reactions_comment_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."discussion_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_reactions" ADD CONSTRAINT "comment_reactions_user_id_profiles_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_comments" ADD CONSTRAINT "discussion_comments_discussion_id_fk" FOREIGN KEY ("discussion_id") REFERENCES "public"."discussions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_comments" ADD CONSTRAINT "discussion_comments_author_id_profiles_fk" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_reactions" ADD CONSTRAINT "discussion_reactions_discussion_id_fk" FOREIGN KEY ("discussion_id") REFERENCES "public"."discussions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_reactions" ADD CONSTRAINT "discussion_reactions_user_id_profiles_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussions" ADD CONSTRAINT "discussions_author_id_profiles_fk" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "authenticated_read_comment_reactions" ON "comment_reactions" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "students_insert_own_comment_reaction" ON "comment_reactions" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("comment_reactions"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "students_delete_own_comment_reaction" ON "comment_reactions" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("comment_reactions"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "authenticated_read_discussion_comments" ON "discussion_comments" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "students_insert_own_comment" ON "discussion_comments" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("discussion_comments"."author_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "students_update_own_comment" ON "discussion_comments" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("discussion_comments"."author_id" = (select auth.uid())) WITH CHECK ("discussion_comments"."author_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "students_delete_own_comment" ON "discussion_comments" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("discussion_comments"."author_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "admins_delete_comments" ON "discussion_comments" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_admin());--> statement-breakpoint
CREATE POLICY "authenticated_read_discussion_reactions" ON "discussion_reactions" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "students_insert_own_reaction" ON "discussion_reactions" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("discussion_reactions"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "students_delete_own_reaction" ON "discussion_reactions" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("discussion_reactions"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "authenticated_read_discussions" ON "discussions" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "students_insert_own_discussion" ON "discussions" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("discussions"."author_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "students_update_own_discussion" ON "discussions" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("discussions"."author_id" = (select auth.uid())) WITH CHECK ("discussions"."author_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "admins_delete_discussions" ON "discussions" AS PERMISSIVE FOR DELETE TO "authenticated" USING (public.is_admin());