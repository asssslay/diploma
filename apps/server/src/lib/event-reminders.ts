import { and, eq, gt } from "drizzle-orm";
import { db } from "@my-better-t-app/db";
import {
  eventRegistrations,
  events,
  profiles,
  userSettings,
} from "@my-better-t-app/db/schema";
import {
  cancelScheduledEmail,
  scheduleEventReminder,
} from "@/lib/emails";
import { runThrottled } from "@/lib/throttle";

export type EventReminderIds = {
  reminder24hEmailId: string | null;
  reminder1hEmailId: string | null;
};

// Schedules the paired 24h and 1h reminders for one event registration lifecycle.
export async function scheduleBothEventReminders(
  email: string,
  title: string,
  eventDate: Date,
  location: string,
  operationId: string,
): Promise<EventReminderIds> {
  // Both reminders share one operation id so retries stay grouped in the mail provider logs.
  const [reminder24hEmailId, reminder1hEmailId] = await Promise.all([
    scheduleEventReminder(email, title, eventDate, location, 24, operationId),
    scheduleEventReminder(email, title, eventDate, location, 1, operationId),
  ]);
  return { reminder24hEmailId, reminder1hEmailId };
}

// Cancels whichever reminder IDs are currently attached to a registration row.
export async function cancelBothEventReminders(
  ids: Partial<EventReminderIds>,
): Promise<void> {
  const tasks: Promise<boolean>[] = [];
  // Missing IDs are normal when reminders were never scheduled or were cleared by preferences.
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
// Cancels all queued reminders linked to an event before destructive admin actions.
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
    // Capture each ID into its own closure so throttling later cannot read a mutated loop variable.
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
// Rebuilds reminders for every registration after event details change.
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
      notifyEventReminders: userSettings.notifyEventReminders,
    })
    .from(eventRegistrations)
    .innerJoin(profiles, eq(eventRegistrations.studentId, profiles.id))
    .leftJoin(userSettings, eq(eventRegistrations.studentId, userSettings.id))
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
      // Cancel first so a date/title edit cannot leave stale reminders behind if rescheduling succeeds.
      await cancelBothEventReminders(row);

      // Respect user notification preferences (no row = default true)
      if (row.notifyEventReminders === false) {
        await db
          .update(eventRegistrations)
          .set({ reminder24hEmailId: null, reminder1hEmailId: null })
          .where(eq(eventRegistrations.id, row.registrationId));
        return;
      }

      // Missing email is treated as a recoverable data issue; we clear stored ids so later retries are clean.
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
      // Scheduling both reminders before the DB update avoids persisting IDs for emails that never got queued.
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

/**
 * Cancels all scheduled event reminders for a user and nulls out
 * the stored Resend IDs. Called when the user disables event notifications.
 */
// Clears every stored and queued event reminder owned by one user.
export async function cancelAllUserEventReminders(
  userId: string,
): Promise<void> {
  const rows = await db
    .select({
      id: eventRegistrations.id,
      reminder24hEmailId: eventRegistrations.reminder24hEmailId,
      reminder1hEmailId: eventRegistrations.reminder1hEmailId,
    })
    .from(eventRegistrations)
    .where(eq(eventRegistrations.studentId, userId));

  const cancelTasks: Array<() => Promise<boolean>> = [];
  for (const row of rows) {
    // We only enqueue provider cancels for IDs we actually stored, then null everything in one DB write below.
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
      `[events] Cancelling ${cancelTasks.length} reminders for user=${userId}`,
    );
    await runThrottled(cancelTasks);
  }

  await db
    .update(eventRegistrations)
    .set({ reminder24hEmailId: null, reminder1hEmailId: null })
    .where(eq(eventRegistrations.studentId, userId));
}

/**
 * Schedules reminders (24h + 1h) for all upcoming event registrations of a user.
 * Called when the user re-enables event notifications.
 */
// Recreates reminders for a user's future registrations after notifications are re-enabled.
export async function scheduleAllUserEventReminders(
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
      registrationId: eventRegistrations.id,
      title: events.title,
      eventDate: events.eventDate,
      location: events.location,
    })
    .from(eventRegistrations)
    .innerJoin(events, eq(eventRegistrations.eventId, events.id))
    .where(
      and(
        eq(eventRegistrations.studentId, userId),
        gt(events.eventDate, new Date()),
      ),
    );

  if (rows.length === 0) return;

  console.log(
    `[events] Scheduling reminders for ${rows.length} event registrations for user=${userId}`,
  );

  const tasks = rows.map((row) => async () => {
    try {
      const operationId = crypto.randomUUID();
      // This path is only for future events; past events are filtered out at query time.
      const reminders = await scheduleBothEventReminders(
        userRow.email,
        row.title,
        row.eventDate,
        row.location,
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
        `[events] Failed to schedule reminders for registration=${row.registrationId}:`,
        err,
      );
    }
  });

  await runThrottled(tasks);
}
