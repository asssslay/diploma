import { zValidator } from "@hono/zod-validator";
import { HTTPException } from "hono/http-exception";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@my-better-t-app/db";
import {
  commentReactions,
  discussionComments,
  discussionReactions,
  discussions,
  profiles,
} from "@my-better-t-app/db/schema";
import { createRouter } from "@/lib/app";
import { auth } from "@/middleware/auth";
import { validationHook } from "@/lib/zod-hook";

const idParamSchema = z.object({ id: z.string().uuid() });
const commentIdParamSchema = z.object({
  id: z.string().uuid(),
  commentId: z.string().uuid(),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(10),
  category: z
    .enum(["general", "academic", "social", "help", "feedback"])
    .optional(),
});

const createDiscussionSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  category: z.enum(["general", "academic", "social", "help", "feedback"]),
});

const updateDiscussionSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).optional(),
  category: z
    .enum(["general", "academic", "social", "help", "feedback"])
    .optional(),
});

const createCommentSchema = z.object({
  content: z.string().min(1).max(500),
});

const updateCommentSchema = z.object({
  content: z.string().min(1).max(500),
});

const app = createRouter()
  .use("/*", auth)

  // List discussions
  .get("/", zValidator("query", listQuerySchema, validationHook), async (c) => {
    const { page, pageSize, category } = c.req.valid("query");
    const offset = (page - 1) * pageSize;

    const where = category
      ? eq(discussions.category, category)
      : undefined;

    const [items, [total]] = await Promise.all([
      db
        .select({
          id: discussions.id,
          title: discussions.title,
          content: discussions.content,
          category: discussions.category,
          authorId: discussions.authorId,
          authorName: profiles.fullName,
          viewCount: discussions.viewCount,
          createdAt: discussions.createdAt,
          updatedAt: discussions.updatedAt,
        })
        .from(discussions)
        .leftJoin(profiles, eq(discussions.authorId, profiles.id))
        .where(where)
        .orderBy(desc(discussions.createdAt))
        .limit(pageSize)
        .offset(offset),
      db
        .select({ value: count() })
        .from(discussions)
        .where(where),
    ]);

    const itemsWithCounts = await Promise.all(
      items.map(async (item) => {
        const [[comments], [reactions]] = await Promise.all([
          db
            .select({ value: count() })
            .from(discussionComments)
            .where(eq(discussionComments.discussionId, item.id)),
          db
            .select({ value: count() })
            .from(discussionReactions)
            .where(eq(discussionReactions.discussionId, item.id)),
        ]);
        return {
          ...item,
          commentCount: comments?.value ?? 0,
          reactionsCount: reactions?.value ?? 0,
        };
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

  // Get discussion detail
  .get("/:id", zValidator("param", idParamSchema, validationHook), async (c) => {
    const { id } = c.req.valid("param");
    const user = c.get("user");

    await db
      .update(discussions)
      .set({ viewCount: sql`${discussions.viewCount} + 1` })
      .where(eq(discussions.id, id));

    const [discussion] = await db
      .select({
        id: discussions.id,
        title: discussions.title,
        content: discussions.content,
        category: discussions.category,
        authorId: discussions.authorId,
        authorName: profiles.fullName,
        viewCount: discussions.viewCount,
        createdAt: discussions.createdAt,
        updatedAt: discussions.updatedAt,
      })
      .from(discussions)
      .leftJoin(profiles, eq(discussions.authorId, profiles.id))
      .where(eq(discussions.id, id))
      .limit(1);

    if (!discussion) {
      throw new HTTPException(404, { message: "Discussion not found" });
    }

    const [[reactionsCount], [userReaction]] = await Promise.all([
      db
        .select({ value: count() })
        .from(discussionReactions)
        .where(eq(discussionReactions.discussionId, id)),
      db
        .select({ value: count() })
        .from(discussionReactions)
        .where(
          and(
            eq(discussionReactions.discussionId, id),
            eq(discussionReactions.userId, user.id),
          ),
        ),
    ]);

    const comments = await db
      .select({
        id: discussionComments.id,
        content: discussionComments.content,
        authorId: discussionComments.authorId,
        authorName: profiles.fullName,
        createdAt: discussionComments.createdAt,
        updatedAt: discussionComments.updatedAt,
      })
      .from(discussionComments)
      .leftJoin(profiles, eq(discussionComments.authorId, profiles.id))
      .where(eq(discussionComments.discussionId, id))
      .orderBy(discussionComments.createdAt);

    const commentsWithReactions = await Promise.all(
      comments.map(async (comment) => {
        const [[cReactions], [cUserReaction]] = await Promise.all([
          db
            .select({ value: count() })
            .from(commentReactions)
            .where(eq(commentReactions.commentId, comment.id)),
          db
            .select({ value: count() })
            .from(commentReactions)
            .where(
              and(
                eq(commentReactions.commentId, comment.id),
                eq(commentReactions.userId, user.id),
              ),
            ),
        ]);
        return {
          ...comment,
          reactionsCount: cReactions?.value ?? 0,
          isReacted: (cUserReaction?.value ?? 0) > 0,
        };
      }),
    );

    return c.json({
      success: true,
      data: {
        ...discussion,
        reactionsCount: reactionsCount?.value ?? 0,
        isReacted: (userReaction?.value ?? 0) > 0,
        comments: commentsWithReactions,
      },
    });
  })

  // Create discussion
  .post(
    "/",
    zValidator("json", createDiscussionSchema, validationHook),
    async (c) => {
      const { title, content, category } = c.req.valid("json");
      const user = c.get("user");

      const [discussion] = await db
        .insert(discussions)
        .values({ title, content, category, authorId: user.id })
        .returning();

      return c.json({ success: true, data: discussion }, 201);
    },
  )

  // Edit own discussion
  .patch(
    "/:id",
    zValidator("param", idParamSchema, validationHook),
    zValidator("json", updateDiscussionSchema, validationHook),
    async (c) => {
      const { id } = c.req.valid("param");
      const user = c.get("user");
      const updates = c.req.valid("json");

      const [existing] = await db
        .select({ id: discussions.id, authorId: discussions.authorId })
        .from(discussions)
        .where(eq(discussions.id, id))
        .limit(1);

      if (!existing) {
        throw new HTTPException(404, { message: "Discussion not found" });
      }

      if (existing.authorId !== user.id) {
        throw new HTTPException(403, {
          message: "You can only edit your own discussions",
        });
      }

      const [discussion] = await db
        .update(discussions)
        .set({ ...updates, updatedAt: sql`now()` })
        .where(eq(discussions.id, id))
        .returning();

      return c.json({ success: true, data: discussion });
    },
  )

  // React to discussion
  .post(
    "/:id/react",
    zValidator("param", idParamSchema, validationHook),
    async (c) => {
      const { id } = c.req.valid("param");
      const user = c.get("user");

      const [existing] = await db
        .select({ id: discussionReactions.id })
        .from(discussionReactions)
        .where(
          and(
            eq(discussionReactions.discussionId, id),
            eq(discussionReactions.userId, user.id),
          ),
        )
        .limit(1);

      if (existing) {
        throw new HTTPException(409, { message: "Already reacted" });
      }

      await db
        .insert(discussionReactions)
        .values({ discussionId: id, userId: user.id });

      return c.json({ success: true, data: { reacted: true } });
    },
  )

  // Remove reaction from discussion
  .delete(
    "/:id/react",
    zValidator("param", idParamSchema, validationHook),
    async (c) => {
      const { id } = c.req.valid("param");
      const user = c.get("user");

      const deleted = await db
        .delete(discussionReactions)
        .where(
          and(
            eq(discussionReactions.discussionId, id),
            eq(discussionReactions.userId, user.id),
          ),
        )
        .returning();

      if (deleted.length === 0) {
        throw new HTTPException(404, { message: "Reaction not found" });
      }

      return c.json({ success: true, data: { reacted: false } });
    },
  )

  // Add comment
  .post(
    "/:id/comments",
    zValidator("param", idParamSchema, validationHook),
    zValidator("json", createCommentSchema, validationHook),
    async (c) => {
      const { id } = c.req.valid("param");
      const user = c.get("user");
      const { content } = c.req.valid("json");

      const [discussion] = await db
        .select({ id: discussions.id })
        .from(discussions)
        .where(eq(discussions.id, id))
        .limit(1);

      if (!discussion) {
        throw new HTTPException(404, { message: "Discussion not found" });
      }

      const [comment] = await db
        .insert(discussionComments)
        .values({ discussionId: id, authorId: user.id, content })
        .returning();

      return c.json({ success: true, data: comment }, 201);
    },
  )

  // Edit own comment
  .patch(
    "/:id/comments/:commentId",
    zValidator("param", commentIdParamSchema, validationHook),
    zValidator("json", updateCommentSchema, validationHook),
    async (c) => {
      const { commentId } = c.req.valid("param");
      const user = c.get("user");
      const { content } = c.req.valid("json");

      const [existing] = await db
        .select({
          id: discussionComments.id,
          authorId: discussionComments.authorId,
        })
        .from(discussionComments)
        .where(eq(discussionComments.id, commentId))
        .limit(1);

      if (!existing) {
        throw new HTTPException(404, { message: "Comment not found" });
      }

      if (existing.authorId !== user.id) {
        throw new HTTPException(403, {
          message: "You can only edit your own comments",
        });
      }

      const [comment] = await db
        .update(discussionComments)
        .set({ content, updatedAt: sql`now()` })
        .where(eq(discussionComments.id, commentId))
        .returning();

      return c.json({ success: true, data: comment });
    },
  )

  // Delete own comment
  .delete(
    "/:id/comments/:commentId",
    zValidator("param", commentIdParamSchema, validationHook),
    async (c) => {
      const { commentId } = c.req.valid("param");
      const user = c.get("user");

      const [existing] = await db
        .select({
          id: discussionComments.id,
          authorId: discussionComments.authorId,
        })
        .from(discussionComments)
        .where(eq(discussionComments.id, commentId))
        .limit(1);

      if (!existing) {
        throw new HTTPException(404, { message: "Comment not found" });
      }

      if (existing.authorId !== user.id) {
        throw new HTTPException(403, {
          message: "You can only delete your own comments",
        });
      }

      await db
        .delete(discussionComments)
        .where(eq(discussionComments.id, commentId));

      return c.json({ success: true, data: { id: commentId } });
    },
  )

  // React to comment
  .post(
    "/:id/comments/:commentId/react",
    zValidator("param", commentIdParamSchema, validationHook),
    async (c) => {
      const { commentId } = c.req.valid("param");
      const user = c.get("user");

      const [existing] = await db
        .select({ id: commentReactions.id })
        .from(commentReactions)
        .where(
          and(
            eq(commentReactions.commentId, commentId),
            eq(commentReactions.userId, user.id),
          ),
        )
        .limit(1);

      if (existing) {
        throw new HTTPException(409, { message: "Already reacted" });
      }

      await db
        .insert(commentReactions)
        .values({ commentId, userId: user.id });

      return c.json({ success: true, data: { reacted: true } });
    },
  )

  // Remove reaction from comment
  .delete(
    "/:id/comments/:commentId/react",
    zValidator("param", commentIdParamSchema, validationHook),
    async (c) => {
      const { commentId } = c.req.valid("param");
      const user = c.get("user");

      const deleted = await db
        .delete(commentReactions)
        .where(
          and(
            eq(commentReactions.commentId, commentId),
            eq(commentReactions.userId, user.id),
          ),
        )
        .returning();

      if (deleted.length === 0) {
        throw new HTTPException(404, { message: "Reaction not found" });
      }

      return c.json({ success: true, data: { reacted: false } });
    },
  );

export default app;
