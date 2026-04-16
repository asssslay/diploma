import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@my-better-t-app/db";
import { userSettings } from "@my-better-t-app/db/schema";
import { createRouter } from "@/lib/app";
import { auth } from "@/middleware/auth";
import { validationHook } from "@/lib/zod-hook";
import {
  cancelAllUserDeadlineReminders,
  scheduleAllUserDeadlineReminders,
} from "@/lib/deadline-reminders";
import {
  cancelAllUserEventReminders,
  scheduleAllUserEventReminders,
} from "@/lib/event-reminders";

const updateSettingsSchema = z.object({
  notifyDeadlineReminders: z.boolean().optional(),
  notifyEventReminders: z.boolean().optional(),
});

async function getOrCreateSettings(userId: string) {
  await db
    .insert(userSettings)
    .values({
      id: userId,
      notifyDeadlineReminders: true,
      notifyEventReminders: true,
    })
    .onConflictDoNothing({ target: userSettings.id });

  const [settings] = await db
    .select({
      notifyDeadlineReminders: userSettings.notifyDeadlineReminders,
      notifyEventReminders: userSettings.notifyEventReminders,
    })
    .from(userSettings)
    .where(eq(userSettings.id, userId))
    .limit(1);

  return settings!;
}

const app = createRouter()
  .use("/*", auth)

  .get("/", async (c) => {
    const user = c.get("user");
    const settings = await getOrCreateSettings(user.id);

    return c.json({ success: true, data: settings });
  })

  .patch(
    "/",
    zValidator("json", updateSettingsSchema, validationHook),
    async (c) => {
      const user = c.get("user");
      const updates = c.req.valid("json");

      const current = await getOrCreateSettings(user.id);

      const setValues: Record<string, boolean> = {};
      if (updates.notifyDeadlineReminders !== undefined) {
        setValues.notifyDeadlineReminders = updates.notifyDeadlineReminders;
      }
      if (updates.notifyEventReminders !== undefined) {
        setValues.notifyEventReminders = updates.notifyEventReminders;
      }

      if (Object.keys(setValues).length > 0) {
        await db
          .update(userSettings)
          .set(setValues)
          .where(eq(userSettings.id, user.id));
      }

      // Detect transitions and perform bulk operations
      if (
        updates.notifyDeadlineReminders !== undefined &&
        updates.notifyDeadlineReminders !== current.notifyDeadlineReminders
      ) {
        if (updates.notifyDeadlineReminders) {
          await scheduleAllUserDeadlineReminders(user.id);
        } else {
          await cancelAllUserDeadlineReminders(user.id);
        }
      }

      if (
        updates.notifyEventReminders !== undefined &&
        updates.notifyEventReminders !== current.notifyEventReminders
      ) {
        if (updates.notifyEventReminders) {
          await scheduleAllUserEventReminders(user.id);
        } else {
          await cancelAllUserEventReminders(user.id);
        }
      }

      return c.json({
        success: true,
        data: {
          notifyDeadlineReminders:
            updates.notifyDeadlineReminders ??
            current.notifyDeadlineReminders,
          notifyEventReminders:
            updates.notifyEventReminders ?? current.notifyEventReminders,
        },
      });
    },
  );

export default app;
