import { and, eq, gt } from "drizzle-orm";
import { db } from "@my-better-t-app/db";
import { deadlines, profiles } from "@my-better-t-app/db/schema";
import {
  cancelScheduledEmail,
  scheduleDeadlineReminder,
} from "@/lib/emails";
import { runThrottled } from "@/lib/throttle";

/**
 * Cancels all scheduled deadline reminders for a user and nulls out
 * the stored Resend IDs. Called when the user disables deadline notifications.
 */
export async function cancelAllUserDeadlineReminders(
  userId: string,
): Promise<void> {
  const rows = await db
    .select({
      id: deadlines.id,
      reminder24hEmailId: deadlines.reminder24hEmailId,
      reminder1hEmailId: deadlines.reminder1hEmailId,
    })
    .from(deadlines)
    .where(eq(deadlines.userId, userId));

  const cancelTasks: Array<() => Promise<boolean>> = [];
  for (const row of rows) {
    if (row.reminder24hEmailId) {
      const emailId = row.reminder24hEmailId;
      cancelTasks.push(() => cancelScheduledEmail(emailId));
    }
    if (row.reminder1hEmailId) {
      const emailId = row.reminder1hEmailId;
      cancelTasks.push(() => cancelScheduledEmail(emailId));
    }
  }

  if (cancelTasks.length > 0) {
    console.log(
      `[deadlines] Cancelling ${cancelTasks.length} reminders for user=${userId}`,
    );
    await runThrottled(cancelTasks);
  }

  await db
    .update(deadlines)
    .set({ reminder24hEmailId: null, reminder1hEmailId: null })
    .where(eq(deadlines.userId, userId));
}

/**
 * Schedules reminders (24h + 1h) for all upcoming deadlines of a user.
 * Called when the user re-enables deadline notifications.
 */
export async function scheduleAllUserDeadlineReminders(
  userId: string,
): Promise<void> {
  const [userRow] = await db
    .select({ email: profiles.email })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  if (!userRow?.email) return;

  const rows = await db
    .select({
      id: deadlines.id,
      title: deadlines.title,
      dueAt: deadlines.dueAt,
    })
    .from(deadlines)
    .where(and(eq(deadlines.userId, userId), gt(deadlines.dueAt, new Date())));

  if (rows.length === 0) return;

  console.log(
    `[deadlines] Scheduling reminders for ${rows.length} deadlines for user=${userId}`,
  );

  const tasks = rows.map((row) => async () => {
    try {
      const operationId = crypto.randomUUID();
      const [reminder24hEmailId, reminder1hEmailId] = await Promise.all([
        scheduleDeadlineReminder(
          userRow.email,
          row.title,
          row.dueAt,
          24,
          operationId,
        ),
        scheduleDeadlineReminder(
          userRow.email,
          row.title,
          row.dueAt,
          1,
          operationId,
        ),
      ]);

      await db
        .update(deadlines)
        .set({ reminder24hEmailId, reminder1hEmailId })
        .where(eq(deadlines.id, row.id));
    } catch (err) {
      console.error(
        `[deadlines] Failed to schedule reminders for deadline=${row.id}:`,
        err,
      );
    }
  });

  await runThrottled(tasks);
}
