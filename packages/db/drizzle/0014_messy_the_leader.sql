CREATE INDEX "deadlines_user_id_due_at_idx" ON "deadlines" USING btree ("user_id","due_at");--> statement-breakpoint
CREATE INDEX "discussion_comments_discussion_id_idx" ON "discussion_comments" USING btree ("discussion_id");--> statement-breakpoint
CREATE INDEX "discussion_comments_author_id_idx" ON "discussion_comments" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "event_registrations_student_id_idx" ON "event_registrations" USING btree ("student_id");