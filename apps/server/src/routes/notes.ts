import { zValidator } from "@hono/zod-validator";
import { HTTPException } from "hono/http-exception";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@my-better-t-app/db";
import { notes } from "@my-better-t-app/db/schema";
import { createRouter } from "@/lib/app";
import { auth } from "@/middleware/auth";
import { validationHook } from "@/lib/zod-hook";

const idParamSchema = z.object({ id: z.string().uuid() });

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(20),
});

const createNoteSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(5000),
});

const updateNoteSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).max(5000).optional(),
});

const app = createRouter()
  .use("/*", auth)

  // List own notes
  .get("/", zValidator("query", listQuerySchema, validationHook), async (c) => {
    const user = c.get("user");
    const { page, pageSize } = c.req.valid("query");
    const offset = (page - 1) * pageSize;

    const [items, totalRows] = await Promise.all([
      db
        .select({
          id: notes.id,
          title: notes.title,
          content: notes.content,
          createdAt: notes.createdAt,
          updatedAt: notes.updatedAt,
        })
        .from(notes)
        .where(eq(notes.userId, user.id))
        .orderBy(desc(notes.updatedAt))
        .limit(pageSize)
        .offset(offset),
      db
        .select({ value: sql<number>`count(*)::int` })
        .from(notes)
        .where(eq(notes.userId, user.id)),
    ]);

    const total = totalRows[0]?.value ?? 0;

    return c.json({ success: true, data: items, total, page, pageSize });
  })

  // Create note
  .post(
    "/",
    zValidator("json", createNoteSchema, validationHook),
    async (c) => {
      const user = c.get("user");
      const { title, content } = c.req.valid("json");

      const rows = await db
        .insert(notes)
        .values({ userId: user.id, title, content })
        .returning();

      const created = rows[0];
      if (!created) {
        throw new HTTPException(500, { message: "Failed to create note" });
      }

      return c.json({ success: true, data: created }, 201);
    },
  )

  // Update note
  .patch(
    "/:id",
    zValidator("param", idParamSchema, validationHook),
    zValidator("json", updateNoteSchema, validationHook),
    async (c) => {
      const user = c.get("user");
      const { id } = c.req.valid("param");
      const updates = c.req.valid("json");

      const rows = await db
        .update(notes)
        .set({ ...updates, updatedAt: new Date() })
        .where(and(eq(notes.id, id), eq(notes.userId, user.id)))
        .returning();

      const updated = rows[0];
      if (!updated) {
        throw new HTTPException(404, { message: "Note not found" });
      }

      return c.json({ success: true, data: updated });
    },
  )

  // Delete note
  .delete(
    "/:id",
    zValidator("param", idParamSchema, validationHook),
    async (c) => {
      const user = c.get("user");
      const { id } = c.req.valid("param");

      const rows = await db
        .delete(notes)
        .where(and(eq(notes.id, id), eq(notes.userId, user.id)))
        .returning({ id: notes.id });

      if (!rows[0]) {
        throw new HTTPException(404, { message: "Note not found" });
      }

      return c.json({ success: true });
    },
  );

export default app;
