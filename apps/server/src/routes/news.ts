import { zValidator } from "@hono/zod-validator";
import { HTTPException } from "hono/http-exception";
import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@my-better-t-app/db";
import { newsPosts, profiles } from "@my-better-t-app/db/schema";
import { createRouter } from "@/lib/app";
import {
  countNewsPostsTotal,
  createNewsExcerpt,
  newsListTotalCount,
} from "@/lib/news-list";
import { auth } from "@/middleware/auth";
import { validationHook } from "@/lib/zod-hook";

const idParamSchema = z.object({
  id: z.string().uuid(),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(10),
});

const app = createRouter()
  .use("/*", auth)

  .get("/", zValidator("query", listQuerySchema, validationHook), async (c) => {
    const { page, pageSize } = c.req.valid("query");
    const offset = (page - 1) * pageSize;

    const rows = await db
      .select({
        id: newsPosts.id,
        title: newsPosts.title,
        content: newsPosts.content,
        imageUrl: newsPosts.imageUrl,
        authorName: profiles.fullName,
        publishedAt: newsPosts.publishedAt,
        viewCount: newsPosts.viewCount,
        createdAt: newsPosts.createdAt,
        updatedAt: newsPosts.updatedAt,
        totalCount: newsListTotalCount,
      })
      .from(newsPosts)
      .leftJoin(profiles, eq(newsPosts.authorId, profiles.id))
      .orderBy(desc(newsPosts.publishedAt))
      .limit(pageSize)
      .offset(offset);

    const total = rows[0]?.totalCount ?? await countNewsPostsTotal();
    const items = rows.map(({ content, totalCount: _totalCount, ...row }) => ({
      ...row,
      excerpt: createNewsExcerpt(content),
    }));

    return c.json({
      success: true,
      data: items,
      total,
      page,
      pageSize,
    });
  })

  .get("/:id", zValidator("param", idParamSchema, validationHook), async (c) => {
    const { id } = c.req.valid("param");

    await db
      .update(newsPosts)
      .set({ viewCount: sql`${newsPosts.viewCount} + 1` })
      .where(eq(newsPosts.id, id));

    const [post] = await db
      .select({
        id: newsPosts.id,
        title: newsPosts.title,
        content: newsPosts.content,
        imageUrl: newsPosts.imageUrl,
        authorName: profiles.fullName,
        publishedAt: newsPosts.publishedAt,
        viewCount: newsPosts.viewCount,
        createdAt: newsPosts.createdAt,
        updatedAt: newsPosts.updatedAt,
      })
      .from(newsPosts)
      .leftJoin(profiles, eq(newsPosts.authorId, profiles.id))
      .where(eq(newsPosts.id, id))
      .limit(1);

    if (!post) {
      throw new HTTPException(404, { message: "News post not found" });
    }

    return c.json({ success: true, data: post });
  });

export default app;
