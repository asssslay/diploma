import { zValidator } from "@hono/zod-validator";
import { HTTPException } from "hono/http-exception";
import { count, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@my-better-t-app/db";
import { newsPosts, profiles } from "@my-better-t-app/db/schema";
import { supabaseAdmin } from "@my-better-t-app/db/supabase-admin";
import { createRouter } from "@/lib/app";
import { adminOnly, auth } from "@/middleware/auth";
import { validationHook } from "@/lib/zod-hook";

const idParamSchema = z.object({
  id: z.string().uuid(),
});

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(10),
});

const createNewsSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  imageUrl: z.string().url().optional(),
});

const updateNewsSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).optional(),
  imageUrl: z.string().url().nullable().optional(),
});

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const app = createRouter()
  .use("/*", auth, adminOnly)

  .get("/", zValidator("query", listQuerySchema, validationHook), async (c) => {
    const { page, pageSize } = c.req.valid("query");
    const offset = (page - 1) * pageSize;

    const [items, [total]] = await Promise.all([
      db
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
        .orderBy(desc(newsPosts.publishedAt))
        .limit(pageSize)
        .offset(offset),

      db.select({ value: count() }).from(newsPosts),
    ]);

    return c.json({
      success: true,
      data: items,
      total: total?.value ?? 0,
      page,
      pageSize,
    });
  })

  .get("/:id", zValidator("param", idParamSchema, validationHook), async (c) => {
    const { id } = c.req.valid("param");

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
  })

  .post("/upload-image", async (c) => {
    const body = await c.req.parseBody();
    const file = body["image"];

    if (!file || typeof file === "string") {
      throw new HTTPException(400, { message: "Image file is required" });
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      throw new HTTPException(400, {
        message: "Image must be JPEG, PNG, or WebP",
      });
    }

    if (file.size > MAX_IMAGE_SIZE) {
      throw new HTTPException(400, { message: "Image must be under 5MB" });
    }

    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `news/${crypto.randomUUID()}.${ext}`;
    const buffer = await file.arrayBuffer();

    const { error } = await supabaseAdmin.storage
      .from("media")
      .upload(path, buffer, { contentType: file.type });

    if (error) {
      throw new HTTPException(500, { message: "Failed to upload image" });
    }

    const { data: urlData } = supabaseAdmin.storage
      .from("media")
      .getPublicUrl(path);

    return c.json({ success: true, data: { imageUrl: urlData.publicUrl } });
  })

  .post("/", zValidator("json", createNewsSchema, validationHook), async (c) => {
    const { title, content, imageUrl } = c.req.valid("json");
    const admin = c.get("profile");

    const [post] = await db
      .insert(newsPosts)
      .values({
        title,
        content,
        imageUrl: imageUrl ?? null,
        authorId: admin.id,
      })
      .returning();

    return c.json({ success: true, data: post }, 201);
  })

  .patch(
    "/:id",
    zValidator("param", idParamSchema, validationHook),
    zValidator("json", updateNewsSchema, validationHook),
    async (c) => {
      const { id } = c.req.valid("param");
      const updates = c.req.valid("json");

      const [existing] = await db
        .select({ id: newsPosts.id })
        .from(newsPosts)
        .where(eq(newsPosts.id, id))
        .limit(1);

      if (!existing) {
        throw new HTTPException(404, { message: "News post not found" });
      }

      const [post] = await db
        .update(newsPosts)
        .set({ ...updates, updatedAt: sql`now()` })
        .where(eq(newsPosts.id, id))
        .returning();

      return c.json({ success: true, data: post });
    },
  )

  .delete("/:id", zValidator("param", idParamSchema, validationHook), async (c) => {
    const { id } = c.req.valid("param");

    const deleted = await db
      .delete(newsPosts)
      .where(eq(newsPosts.id, id))
      .returning();

    if (deleted.length === 0) {
      throw new HTTPException(404, { message: "News post not found" });
    }

    return c.json({ success: true, data: { id } });
  });

export default app;
