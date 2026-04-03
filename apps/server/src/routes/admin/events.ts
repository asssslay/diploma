import { zValidator } from "@hono/zod-validator";
import { HTTPException } from "hono/http-exception";
import { count, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@my-better-t-app/db";
import {
  events,
  eventRegistrations,
  profiles,
  studentProfiles,
} from "@my-better-t-app/db/schema";
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

const createEventSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  imageUrl: z.string().url().optional(),
  eventDate: z.string().datetime(),
  location: z.string().min(1).max(300),
  maxParticipants: z.number().int().positive(),
});

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const app = createRouter()
  .use("/*", auth, adminOnly)

  .get("/", zValidator("query", listQuerySchema, validationHook), async (c) => {
    const { page, pageSize } = c.req.valid("query");
    const offset = (page - 1) * pageSize;

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
        })
        .from(events)
        .leftJoin(profiles, eq(events.authorId, profiles.id))
        .orderBy(desc(events.eventDate))
        .limit(pageSize)
        .offset(offset),

      db.select({ value: count() }).from(events),
    ]);

    const eventsWithCount = await Promise.all(
      items.map(async (event) => {
        const [reg] = await db
          .select({ value: count() })
          .from(eventRegistrations)
          .where(eq(eventRegistrations.eventId, event.id));
        return { ...event, registrationCount: reg?.value ?? 0 };
      }),
    );

    return c.json({
      success: true,
      data: eventsWithCount,
      total: total?.value ?? 0,
      page,
      pageSize,
    });
  })

  .get("/:id", zValidator("param", idParamSchema, validationHook), async (c) => {
    const { id } = c.req.valid("param");

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

    const registrations = await db
      .select({
        id: eventRegistrations.id,
        studentName: profiles.fullName,
        studentEmail: profiles.email,
        group: studentProfiles.group,
        registeredAt: eventRegistrations.registeredAt,
      })
      .from(eventRegistrations)
      .innerJoin(profiles, eq(eventRegistrations.studentId, profiles.id))
      .leftJoin(studentProfiles, eq(eventRegistrations.studentId, studentProfiles.id))
      .where(eq(eventRegistrations.eventId, id))
      .orderBy(desc(eventRegistrations.registeredAt));

    return c.json({
      success: true,
      data: { ...event, registrations, registrationCount: registrations.length },
    });
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
    const path = `events/${crypto.randomUUID()}.${ext}`;
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

  .post("/", zValidator("json", createEventSchema, validationHook), async (c) => {
    const { title, description, imageUrl, eventDate, location, maxParticipants } =
      c.req.valid("json");
    const admin = c.get("profile");

    const [event] = await db
      .insert(events)
      .values({
        title,
        description,
        imageUrl: imageUrl ?? null,
        authorId: admin.id,
        eventDate: new Date(eventDate),
        location,
        maxParticipants,
      })
      .returning();

    return c.json({ success: true, data: event }, 201);
  });

export default app;
