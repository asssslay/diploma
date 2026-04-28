import { zValidator } from "@hono/zod-validator";
import { HTTPException } from "hono/http-exception";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@my-better-t-app/db";
import { deadlines, profiles, userSettings } from "@my-better-t-app/db/schema";
import { createRouter } from "@/lib/app";
import { auth } from "@/middleware/auth";
import { validationHook } from "@/lib/zod-hook";
import { cancelScheduledEmail, scheduleDeadlineReminder } from "@/lib/emails";

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

type ReminderIds = {
  reminder24hEmailId: string | null;
  reminder1hEmailId: string | null;
};

async function scheduleBothReminders(
  email: string,
  title: string,
  dueAt: Date,
  operationId: string,
): Promise<ReminderIds> {
  // The 24h and 1h reminders are always managed as a pair throughout this route.
  const [reminder24hEmailId, reminder1hEmailId] = await Promise.all([
    scheduleDeadlineReminder(email, title, dueAt, 24, operationId),
    scheduleDeadlineReminder(email, title, dueAt, 1, operationId),
  ]);
  return { reminder24hEmailId, reminder1hEmailId };
}

async function cancelBothReminders(ids: Partial<ReminderIds>): Promise<void> {
  const tasks: Promise<boolean>[] = [];
  if (ids.reminder24hEmailId)
    tasks.push(cancelScheduledEmail(ids.reminder24hEmailId));
  if (ids.reminder1hEmailId)
    tasks.push(cancelScheduledEmail(ids.reminder1hEmailId));
  await Promise.all(tasks);
}

const app = createRouter()
  .use("/*", auth)

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
          reminder24hEmailId: deadlines.reminder24hEmailId,
          reminder1hEmailId: deadlines.reminder1hEmailId,
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

  // Create deadline + schedule both reminders (24h and 1h before due)
  .post(
    "/",
    zValidator("json", createDeadlineSchema, validationHook),
    async (c) => {
      const user = c.get("user");
      const { title, dueAt } = c.req.valid("json");
      const dueDate = new Date(dueAt);

      const email = await getUserEmail(user.id);

      const [settingsRow] = await db
        .select({ notify: userSettings.notifyDeadlineReminders })
        .from(userSettings)
        .where(eq(userSettings.id, user.id))
        .limit(1);
      const notifyEnabled = settingsRow?.notify ?? true;

      const operationId = crypto.randomUUID();
      // Users without email or with reminders disabled still get the deadline row, just without queued emails.
      const reminders: ReminderIds = email && notifyEnabled
        ? await scheduleBothReminders(email, title, dueDate, operationId)
        : { reminder24hEmailId: null, reminder1hEmailId: null };

      const rows = await db
        .insert(deadlines)
        .values({
          userId: user.id,
          title,
          dueAt: dueDate,
          reminder24hEmailId: reminders.reminder24hEmailId,
          reminder1hEmailId: reminders.reminder1hEmailId,
        })
        .returning();

      const created = rows[0];
      if (!created) {
        throw new HTTPException(500, { message: "Failed to create deadline" });
      }

      return c.json({ success: true, data: created }, 201);
    },
  )

  // Update deadline + re-sync both reminders
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
          reminder24hEmailId: deadlines.reminder24hEmailId,
          reminder1hEmailId: deadlines.reminder1hEmailId,
        })
        .from(deadlines)
        .where(and(eq(deadlines.id, id), eq(deadlines.userId, user.id)))
        .limit(1);

      if (!existing) {
        throw new HTTPException(404, { message: "Deadline not found" });
      }

      const newDueAt = updates.dueAt ? new Date(updates.dueAt) : existing.dueAt;
      const newTitle = updates.title ?? existing.title;
      const titleChanged =
        updates.title !== undefined && updates.title !== existing.title;
      const dueAtChanged =
        updates.dueAt !== undefined &&
        newDueAt.getTime() !== existing.dueAt.getTime();

      let reminders: ReminderIds = {
        reminder24hEmailId: existing.reminder24hEmailId,
        reminder1hEmailId: existing.reminder1hEmailId,
      };

      // Reminder IDs only need to change when the content or timing of the email changes.
      if (titleChanged || dueAtChanged) {
        await cancelBothReminders(existing);
        reminders = { reminder24hEmailId: null, reminder1hEmailId: null };
        const email = await getUserEmail(user.id);
        const [settingsRow] = await db
          .select({ notify: userSettings.notifyDeadlineReminders })
          .from(userSettings)
          .where(eq(userSettings.id, user.id))
          .limit(1);
        const notifyEnabled = settingsRow?.notify ?? true;

        if (email && notifyEnabled) {
          const operationId = crypto.randomUUID();
          reminders = await scheduleBothReminders(
            email,
            newTitle,
            newDueAt,
            operationId,
          );
        }
      }

      const rows = await db
        .update(deadlines)
        .set({
          ...(updates.title ? { title: updates.title } : {}),
          ...(updates.dueAt ? { dueAt: newDueAt } : {}),
          reminder24hEmailId: reminders.reminder24hEmailId,
          reminder1hEmailId: reminders.reminder1hEmailId,
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

  // Delete deadline + cancel both reminders
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
          reminder24hEmailId: deadlines.reminder24hEmailId,
          reminder1hEmailId: deadlines.reminder1hEmailId,
        });

      const deleted = rows[0];
      if (!deleted) {
        throw new HTTPException(404, { message: "Deadline not found" });
      }

      // Delete first, then cancel provider jobs, so the deadline cannot survive a successful UI delete request.
      console.log(
        `[deadlines] Deleted deadline=${id} reminder24hEmailId=${deleted.reminder24hEmailId ?? "null"} reminder1hEmailId=${deleted.reminder1hEmailId ?? "null"}`,
      );

      await cancelBothReminders(deleted);

      return c.json({ success: true });
    },
  );

export default app;
