import { eq } from "drizzle-orm";
import { db } from "@my-better-t-app/db";
import { eventRegistrations, profiles } from "@my-better-t-app/db/schema";
import {
  cancelScheduledEmail,
  scheduleEventReminder,
} from "@/lib/emails";
import { runThrottled } from "@/lib/throttle";

export type EventReminderIds = {
  reminder24hEmailId: string | null;
  reminder1hEmailId: string | null;
};

export async function scheduleBothEventReminders(
  email: string,
  title: string,
  eventDate: Date,
  location: string,
  operationId: string,
): Promise<EventReminderIds> {
  const [reminder24hEmailId, reminder1hEmailId] = await Promise.all([
    scheduleEventReminder(email, title, eventDate, location, 24, operationId),
    scheduleEventReminder(email, title, eventDate, location, 1, operationId),
  ]);
  return { reminder24hEmailId, reminder1hEmailId };
}

export async function cancelBothEventReminders(
  ids: Partial<EventReminderIds>,
): Promise<void> {
  const tasks: Promise<boolean>[] = [];
  if (ids.reminder24hEmailId)
    tasks.push(cancelScheduledEmail(ids.reminder24hEmailId));
  if (ids.reminder1hEmailId)
    tasks.push(cancelScheduledEmail(ids.reminder1hEmailId));
  await Promise.all(tasks);
}

/**
 * Cancels every scheduled reminder for an event's registrations. Does NOT
 * delete registration rows — the caller should delete the event after this
 * resolves so the FK cascade wipes the rows.
 *
 * Throttled to stay under Resend's 5 rps team limit.
 */
export async function cancelAllEventReminders(
  eventId: string,
): Promise<number> {
  const rows = await db
    .select({
      reminder24hEmailId: eventRegistrations.reminder24hEmailId,
      reminder1hEmailId: eventRegistrations.reminder1hEmailId,
    })
    .from(eventRegistrations)
    .where(eq(eventRegistrations.eventId, eventId));

  const cancelTasks: Array<() => Promise<boolean>> = [];
  for (const row of rows) {
    if (row.reminder24hEmailId) {
      const id = row.reminder24hEmailId;
      cancelTasks.push(() => cancelScheduledEmail(id));
    }
    if (row.reminder1hEmailId) {
      const id = row.reminder1hEmailId;
      cancelTasks.push(() => cancelScheduledEmail(id));
    }
  }

  if (cancelTasks.length === 0) {
    console.log(`[events] No reminders to cancel for event=${eventId}`);
    return 0;
  }

  console.log(
    `[events] Cancelling ${cancelTasks.length} reminders for event=${eventId}`,
  );
  await runThrottled(cancelTasks);
  return cancelTasks.length;
}

/**
 * For every registration of an event, cancels old reminders and schedules
 * new ones with the updated title/date/location, persisting the new ids.
 *
 * Per-registration: 2 cancels in parallel, then 2 schedules in parallel, then
 * a single UPDATE. The outer loop is throttled to stay under Resend's 5 rps
 * team limit.
 */
export async function rescheduleAllEventReminders(
  eventId: string,
  newTitle: string,
  newEventDate: Date,
  newLocation: string,
): Promise<void> {
  const rows = await db
    .select({
      registrationId: eventRegistrations.id,
      studentId: eventRegistrations.studentId,
      email: profiles.email,
      reminder24hEmailId: eventRegistrations.reminder24hEmailId,
      reminder1hEmailId: eventRegistrations.reminder1hEmailId,
    })
    .from(eventRegistrations)
    .innerJoin(profiles, eq(eventRegistrations.studentId, profiles.id))
    .where(eq(eventRegistrations.eventId, eventId));

  if (rows.length === 0) {
    console.log(`[events] No registrations to reschedule for event=${eventId}`);
    return;
  }

  console.log(
    `[events] Rescheduling reminders for ${rows.length} registrations on event=${eventId}`,
  );

  const tasks = rows.map((row) => async () => {
    try {
      await cancelBothEventReminders(row);

      if (!row.email) {
        console.warn(
          `[events] Skipping reschedule for registration=${row.registrationId}: missing email`,
        );
        await db
          .update(eventRegistrations)
          .set({ reminder24hEmailId: null, reminder1hEmailId: null })
          .where(eq(eventRegistrations.id, row.registrationId));
        return;
      }

      const operationId = crypto.randomUUID();
      const reminders = await scheduleBothEventReminders(
        row.email,
        newTitle,
        newEventDate,
        newLocation,
        operationId,
      );

      await db
        .update(eventRegistrations)
        .set({
          reminder24hEmailId: reminders.reminder24hEmailId,
          reminder1hEmailId: reminders.reminder1hEmailId,
        })
        .where(eq(eventRegistrations.id, row.registrationId));
    } catch (err) {
      console.error(
        `[events] Failed to reschedule registration=${row.registrationId}:`,
        err,
      );
    }
  });

  await runThrottled(tasks);
}

