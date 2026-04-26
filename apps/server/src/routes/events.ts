import { zValidator } from "@hono/zod-validator";
import { HTTPException } from "hono/http-exception";
import { and, count, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@my-better-t-app/db";
import { events, eventRegistrations, profiles } from "@my-better-t-app/db/schema";
import { createRouter } from "@/lib/app";
import {
  registerForEvent,
  syncEventRegistrationReminders,
} from "@/lib/event-registration";
import { auth } from "@/middleware/auth";
import { validationHook } from "@/lib/zod-hook";
import {
  cancelBothEventReminders,
} from "@/lib/event-reminders";

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
    const user = c.get("user");

    const [items, [total]] = await Promise.all([
      db
        .select({
          id: events.id,
          title: events.title,
          description: events.description,
          imageUrl: events.imageUrl,
          authorName: profiles.fullName,
          eventDate: events.eventDate,
          location: events.location,
          maxParticipants: events.maxParticipants,
          createdAt: events.createdAt,
          updatedAt: events.updatedAt,
        })
        .from(events)
        .leftJoin(profiles, eq(events.authorId, profiles.id))
        .orderBy(desc(events.eventDate))
        .limit(pageSize)
        .offset(offset),

      db.select({ value: count() }).from(events),
    ]);

    const eventsWithMeta = await Promise.all(
      items.map(async (event) => {
        const [[reg], [userReg]] = await Promise.all([
          db
            .select({ value: count() })
            .from(eventRegistrations)
            .where(eq(eventRegistrations.eventId, event.id)),
          db
            .select({ value: count() })
            .from(eventRegistrations)
            .where(
              and(
                eq(eventRegistrations.eventId, event.id),
                eq(eventRegistrations.studentId, user.id),
              ),
            ),
        ]);
        return {
          ...event,
          registrationCount: reg?.value ?? 0,
          isRegistered: (userReg?.value ?? 0) > 0,
        };
      }),
    );

    return c.json({
      success: true,
      data: eventsWithMeta,
      total: total?.value ?? 0,
      page,
      pageSize,
    });
  })

  .get("/:id", zValidator("param", idParamSchema, validationHook), async (c) => {
    const { id } = c.req.valid("param");
    const user = c.get("user");

    const [event] = await db
      .select({
        id: events.id,
        title: events.title,
        description: events.description,
        imageUrl: events.imageUrl,
        authorName: profiles.fullName,
        eventDate: events.eventDate,
        location: events.location,
        maxParticipants: events.maxParticipants,
        createdAt: events.createdAt,
        updatedAt: events.updatedAt,
      })
      .from(events)
      .leftJoin(profiles, eq(events.authorId, profiles.id))
      .where(eq(events.id, id))
      .limit(1);

    if (!event) {
      throw new HTTPException(404, { message: "Event not found" });
    }

    const [[reg], [userReg]] = await Promise.all([
      db
        .select({ value: count() })
        .from(eventRegistrations)
        .where(eq(eventRegistrations.eventId, id)),
      db
        .select({ value: count() })
        .from(eventRegistrations)
        .where(
          and(
            eq(eventRegistrations.eventId, id),
            eq(eventRegistrations.studentId, user.id),
          ),
        ),
    ]);

    return c.json({
      success: true,
      data: {
        ...event,
        registrationCount: reg?.value ?? 0,
        isRegistered: (userReg?.value ?? 0) > 0,
      },
    });
  })

  .post("/:id/register", zValidator("param", idParamSchema, validationHook), async (c) => {
    const { id } = c.req.valid("param");
    const user = c.get("user");

    const registeredEvent = await registerForEvent(id, user.id);
    await syncEventRegistrationReminders({
      ...registeredEvent,
      studentId: user.id,
    });

    return c.json({ success: true, data: { eventId: id, registered: true } });
  })

  .delete("/:id/register", zValidator("param", idParamSchema, validationHook), async (c) => {
    const { id } = c.req.valid("param");
    const user = c.get("user");

    const deleted = await db
      .delete(eventRegistrations)
      .where(
        and(
          eq(eventRegistrations.eventId, id),
          eq(eventRegistrations.studentId, user.id),
        ),
      )
      .returning({
        reminder24hEmailId: eventRegistrations.reminder24hEmailId,
        reminder1hEmailId: eventRegistrations.reminder1hEmailId,
      });

    const removed = deleted[0];
    if (!removed) {
      throw new HTTPException(404, { message: "Registration not found" });
    }

    await cancelBothEventReminders(removed);

    return c.json({ success: true, data: { eventId: id, registered: false } });
  });

export default app;
