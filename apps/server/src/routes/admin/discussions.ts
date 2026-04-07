import { zValidator } from "@hono/zod-validator";
import { HTTPException } from "hono/http-exception";
import { count, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@my-better-t-app/db";
import {
  discussionComments,
  discussions,
  profiles,
} from "@my-better-t-app/db/schema";
import { createRouter } from "@/lib/app";
import { adminOnly, auth } from "@/middleware/auth";
import { validationHook } from "@/lib/zod-hook";

const idParamSchema = z.object({ id: z.string().uuid() });
const commentIdParamSchema = z.object({
  id: z.string().uuid(),
  commentId: z.string().uuid(),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(10),
});

const app = createRouter()
  .use("/*", auth, adminOnly)

  .get("/", zValidator("query", listQuerySchema, validationHook), async (c) => {
    const { page, pageSize } = c.req.valid("query");
    const offset = (page - 1) * pageSize;

    const [items, [total]] = await Promise.all([
      db
        .select({
          id: discussions.id,
          title: discussions.title,
          category: discussions.category,
          authorName: profiles.fullName,
          createdAt: discussions.createdAt,
        })
        .from(discussions)
        .leftJoin(profiles, eq(discussions.authorId, profiles.id))
        .orderBy(desc(discussions.createdAt))
        .limit(pageSize)
        .offset(offset),
      db.select({ value: count() }).from(discussions),
    ]);

    const itemsWithCounts = await Promise.all(
      items.map(async (item) => {
        const [comments] = await db
          .select({ value: count() })
          .from(discussionComments)
          .where(eq(discussionComments.discussionId, item.id));
        return { ...item, commentCount: comments?.value ?? 0 };
      }),
    );

    return c.json({
      success: true,
      data: itemsWithCounts,
      total: total?.value ?? 0,
      page,
      pageSize,
    });
  })

  .delete(
    "/:id",
    zValidator("param", idParamSchema, validationHook),
    async (c) => {
      const { id } = c.req.valid("param");

      const deleted = await db
        .delete(discussions)
        .where(eq(discussions.id, id))
        .returning();

      if (deleted.length === 0) {
        throw new HTTPException(404, { message: "Discussion not found" });
      }

      return c.json({ success: true, data: { id } });
    },
  )

  .delete(
    "/:id/comments/:commentId",
    zValidator("param", commentIdParamSchema, validationHook),
    async (c) => {
      const { commentId } = c.req.valid("param");

      const deleted = await db
        .delete(discussionComments)
        .where(eq(discussionComments.id, commentId))
        .returning();

      if (deleted.length === 0) {
        throw new HTTPException(404, { message: "Comment not found" });
      }

      return c.json({ success: true, data: { id: commentId } });
    },
  );

export default app;
