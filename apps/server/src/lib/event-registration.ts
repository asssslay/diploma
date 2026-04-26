import { HTTPException } from "hono/http-exception";
import { and, count, eq } from "drizzle-orm";
import { db } from "@my-better-t-app/db";
import {
  eventRegistrations,
  events,
  profiles,
  userSettings,
} from "@my-better-t-app/db/schema";
import { scheduleBothEventReminders } from "@/lib/event-reminders";

type RegisteredEvent = {
  eventId: string;
  title: string;
  eventDate: Date;
  location: string;
};

type SyncEventRegistrationRemindersParams = RegisteredEvent & {
  studentId: string;
};

export async function registerForEvent(
  eventId: string,
  studentId: string,
): Promise<RegisteredEvent> {
  return db.transaction(async (tx) => {
    const [event] = await tx
      .select({
        id: events.id,
        title: events.title,
        eventDate: events.eventDate,
        location: events.location,
        maxParticipants: events.maxParticipants,
      })
      .from(events)
      .where(eq(events.id, eventId))
      .for("update")
      .limit(1);

    if (!event) {
      throw new HTTPException(404, { message: "Event not found" });
    }

    const [existing] = await tx
      .select({ id: eventRegistrations.id })
      .from(eventRegistrations)
      .where(
        and(
          eq(eventRegistrations.eventId, eventId),
          eq(eventRegistrations.studentId, studentId),
        ),
      )
      .limit(1);

    if (existing) {
      throw new HTTPException(409, {
        message: "Already registered for this event",
      });
    }

    const [regCount] = await tx
      .select({ value: count() })
      .from(eventRegistrations)
      .where(eq(eventRegistrations.eventId, eventId));

    if ((regCount?.value ?? 0) >= event.maxParticipants) {
      throw new HTTPException(409, { message: "Event is full" });
    }

    try {
      await tx.insert(eventRegistrations).values({
        eventId,
        studentId,
        reminder24hEmailId: null,
        reminder1hEmailId: null,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new HTTPException(409, {
          message: "Already registered for this event",
        });
      }
      throw error;
    }

    return {
      eventId: event.id,
      title: event.title,
      eventDate: event.eventDate,
      location: event.location,
    };
  });
}

export async function syncEventRegistrationReminders(
  params: SyncEventRegistrationRemindersParams,
): Promise<void> {
  const { eventId, studentId, title, eventDate, location } = params;

  try {
    const [[studentProfile], [settingsRow]] = await Promise.all([
      db
        .select({ email: profiles.email })
        .from(profiles)
        .where(eq(profiles.id, studentId))
        .limit(1),
      db
        .select({ notify: userSettings.notifyEventReminders })
        .from(userSettings)
        .where(eq(userSettings.id, studentId))
        .limit(1),
    ]);

    const notifyEnabled = settingsRow?.notify ?? true;
    if (!studentProfile?.email || !notifyEnabled) {
      return;
    }

    const operationId = crypto.randomUUID();
    const reminders = await scheduleBothEventReminders(
      studentProfile.email,
      title,
      eventDate,
      location,
      operationId,
    );

    if (!reminders.reminder24hEmailId && !reminders.reminder1hEmailId) {
      return;
    }

    const updated = await db
      .update(eventRegistrations)
      .set({
        reminder24hEmailId: reminders.reminder24hEmailId,
        reminder1hEmailId: reminders.reminder1hEmailId,
      })
      .where(
        and(
          eq(eventRegistrations.eventId, eventId),
          eq(eventRegistrations.studentId, studentId),
        ),
      )
      .returning({ id: eventRegistrations.id });

    if (!updated[0]) {
      console.warn(
        `[events] Registration disappeared before reminder sync completed for event=${eventId} student=${studentId}`,
      );
    }
  } catch (error) {
    console.error(
      `[events] Failed to sync reminders for event=${eventId} student=${studentId}:`,
      error,
    );
  }
}

function isUniqueViolation(error: unknown): error is { code: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}
