CREATE TABLE "news_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"image_url" text,
	"author_id" uuid,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "news_posts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "news_posts" ADD CONSTRAINT "news_posts_author_id_profiles_fk" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "admins_manage_news" ON "news_posts" AS PERMISSIVE FOR SELECT TO "authenticated" USING (public.is_admin());--> statement-breakpoint
CREATE POLICY "authenticated_read_news" ON "news_posts" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "admins_insert_news" ON "news_posts" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (public.is_admin());--> statement-breakpoint
CREATE POLICY "admins_update_news" ON "news_posts" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (public.is_admin()) WITH CHECK (public.is_admin());