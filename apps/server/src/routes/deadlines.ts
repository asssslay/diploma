import { zValidator } from "@hono/zod-validator";
import { HTTPException } from "hono/http-exception";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@my-better-t-app/db";
import { deadlines, profiles } from "@my-better-t-app/db/schema";
import { createRouter } from "@/lib/app";
import { auth } from "@/middleware/auth";
import { validationHook } from "@/lib/zod-hook";
import {
  cancelDeadlineReminder,
  scheduleDeadlineReminder,
  updateDeadlineReminder,
} from "@/lib/emails";

const idParamSchema = z.object({ id: z.string().uuid() });

const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(50),
});

const futureDate = z.iso
  .datetime()
  .refine((value) => new Date(value).getTime() > Date.now(), {
    message: "Due date must be in the future",
  });

const createDeadlineSchema = z.object({
  title: z.string().min(1).max(200),
  dueAt: futureDate,
});

const updateDeadlineSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  dueAt: futureDate.optional(),
});

async function getUserEmail(userId: string): Promise<string | null> {
  const rows = await db
    .select({ email: profiles.email })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);
  return rows[0]?.email ?? null;
}

const app = createRouter()
  .use("/*", auth)

  // List own deadlines (ordered by due date ascending — soonest first)
  .get("/", zValidator("query", listQuerySchema, validationHook), async (c) => {
    const user = c.get("user");
    const { page, pageSize } = c.req.valid("query");
    const offset = (page - 1) * pageSize;

    const [items, totalRows] = await Promise.all([
      db
        .select({
          id: deadlines.id,
          title: deadlines.title,
          dueAt: deadlines.dueAt,
          reminderEmailId: deadlines.reminderEmailId,
          createdAt: deadlines.createdAt,
          updatedAt: deadlines.updatedAt,
        })
        .from(deadlines)
        .where(eq(deadlines.userId, user.id))
        .orderBy(asc(deadlines.dueAt))
        .limit(pageSize)
        .offset(offset),
      db
        .select({ value: sql<number>`count(*)::int` })
        .from(deadlines)
        .where(eq(deadlines.userId, user.id)),
    ]);

    const total = totalRows[0]?.value ?? 0;

    return c.json({ success: true, data: items, total, page, pageSize });
  })

  // Create deadline + schedule reminder if within 30 days
  .post(
    "/",
    zValidator("json", createDeadlineSchema, validationHook),
    async (c) => {
      const user = c.get("user");
      const { title, dueAt } = c.req.valid("json");
      const dueDate = new Date(dueAt);

      const email = await getUserEmail(user.id);
      const reminderEmailId = email
        ? await scheduleDeadlineReminder(email, title, dueDate)
        : null;

      const rows = await db
        .insert(deadlines)
        .values({
          userId: user.id,
          title,
          dueAt: dueDate,
          reminderEmailId,
        })
        .returning();

      const created = rows[0];
      if (!created) {
        throw new HTTPException(500, { message: "Failed to create deadline" });
      }

      return c.json({ success: true, data: created }, 201);
    },
  )

  // Update deadline + re-sync reminder if dueAt changed
  .patch(
    "/:id",
    zValidator("param", idParamSchema, validationHook),
    zValidator("json", updateDeadlineSchema, validationHook),
    async (c) => {
      const user = c.get("user");
      const { id } = c.req.valid("param");
      const updates = c.req.valid("json");

      const [existing] = await db
        .select({
          id: deadlines.id,
          title: deadlines.title,
          dueAt: deadlines.dueAt,
          reminderEmailId: deadlines.reminderEmailId,
        })
        .from(deadlines)
        .where(and(eq(deadlines.id, id), eq(deadlines.userId, user.id)))
        .limit(1);

      if (!existing) {
        throw new HTTPException(404, { message: "Deadline not found" });
      }

      const newDueAt = updates.dueAt ? new Date(updates.dueAt) : existing.dueAt;
      const newTitle = updates.title ?? existing.title;
      const dueAtChanged = newDueAt.getTime() !== existing.dueAt.getTime();

      let reminderEmailId = existing.reminderEmailId;

      if (dueAtChanged) {
        if (existing.reminderEmailId) {
          // Try updating the existing scheduled email
          const updated = await updateDeadlineReminder(
            existing.reminderEmailId,
            newDueAt,
          );
          if (updated) {
            reminderEmailId = updated;
          } else {
            // Update failed (e.g. moved out of range or already sent) — cancel and maybe reschedule
            void cancelDeadlineReminder(existing.reminderEmailId);
            reminderEmailId = null;
            const email = await getUserEmail(user.id);
            if (email) {
              reminderEmailId = await scheduleDeadlineReminder(
                email,
                newTitle,
                newDueAt,
              );
            }
          }
        } else {
          // No existing reminder — try to schedule one now
          const email = await getUserEmail(user.id);
          if (email) {
            reminderEmailId = await scheduleDeadlineReminder(
              email,
              newTitle,
              newDueAt,
            );
          }
        }
      }

      const rows = await db
        .update(deadlines)
        .set({
          ...(updates.title ? { title: updates.title } : {}),
          ...(updates.dueAt ? { dueAt: newDueAt } : {}),
          reminderEmailId,
          updatedAt: new Date(),
        })
        .where(and(eq(deadlines.id, id), eq(deadlines.userId, user.id)))
        .returning();

      const updated = rows[0];
      if (!updated) {
        throw new HTTPException(404, { message: "Deadline not found" });
      }

      return c.json({ success: true, data: updated });
    },
  )

  // Delete deadline + cancel reminder
  .delete(
    "/:id",
    zValidator("param", idParamSchema, validationHook),
    async (c) => {
      const user = c.get("user");
      const { id } = c.req.valid("param");

      const rows = await db
        .delete(deadlines)
        .where(and(eq(deadlines.id, id), eq(deadlines.userId, user.id)))
        .returning({
          id: deadlines.id,
          reminderEmailId: deadlines.reminderEmailId,
        });

      const deleted = rows[0];
      if (!deleted) {
        throw new HTTPException(404, { message: "Deadline not found" });
      }

      if (deleted.reminderEmailId) {
        void cancelDeadlineReminder(deleted.reminderEmailId);
      }

      return c.json({ success: true });
    },
  );

export default app;
