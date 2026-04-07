import { zValidator } from "@hono/zod-validator";
import { HTTPException } from "hono/http-exception";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@my-better-t-app/db";
import { profiles, studentProfiles } from "@my-better-t-app/db/schema";
import { supabaseAdmin } from "@my-better-t-app/db/supabase-admin";
import { createRouter } from "@/lib/app";
import { auth } from "@/middleware/auth";
import { validationHook } from "@/lib/zod-hook";

const idParamSchema = z.object({
  id: z.string().uuid(),
});

const updateProfileSchema = z.object({
  fullName: z.string().min(1).max(100).optional(),
  faculty: z.string().max(200).nullable().optional(),
  group: z.string().max(200).nullable().optional(),
  bio: z.string().max(1000).nullable().optional(),
  interests: z.array(z.string()).optional(),
  avatarUrl: z.string().url().nullable().optional(),
});

const MAX_AVATAR_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];

const app = createRouter()
  .use("/*", auth)

  .get("/me", async (c) => {
    const user = c.get("user");

    const [profile] = await db
      .select({
        id: profiles.id,
        email: profiles.email,
        fullName: profiles.fullName,
        role: profiles.role,
        status: profiles.status,
        createdAt: profiles.createdAt,
        faculty: studentProfiles.faculty,
        group: studentProfiles.group,
        avatarUrl: studentProfiles.avatarUrl,
        bio: studentProfiles.bio,
        interests: studentProfiles.interests,
      })
      .from(profiles)
      .leftJoin(studentProfiles, eq(profiles.id, studentProfiles.id))
      .where(eq(profiles.id, user.id))
      .limit(1);

    if (!profile) {
      throw new HTTPException(404, { message: "Profile not found" });
    }

    return c.json({ success: true, data: profile });
  })

  .get("/:id", zValidator("param", idParamSchema, validationHook), async (c) => {
    const { id } = c.req.valid("param");

    const [profile] = await db
      .select({
        id: profiles.id,
        fullName: profiles.fullName,
        createdAt: profiles.createdAt,
        faculty: studentProfiles.faculty,
        group: studentProfiles.group,
        avatarUrl: studentProfiles.avatarUrl,
        bio: studentProfiles.bio,
        interests: studentProfiles.interests,
      })
      .from(profiles)
      .leftJoin(studentProfiles, eq(profiles.id, studentProfiles.id))
      .where(eq(profiles.id, id))
      .limit(1);

    if (!profile) {
      throw new HTTPException(404, { message: "Profile not found" });
    }

    return c.json({ success: true, data: profile });
  })

  .post("/upload-avatar", async (c) => {
    const user = c.get("user");
    const body = await c.req.parseBody();
    const file = body["avatar"];

    if (!file || typeof file === "string") {
      throw new HTTPException(400, { message: "Avatar file is required" });
    }

    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      throw new HTTPException(400, { message: "Avatar must be JPEG, PNG, or WebP" });
    }

    if (file.size > MAX_AVATAR_SIZE) {
      throw new HTTPException(400, { message: "Avatar must be under 2MB" });
    }

    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `avatars/${user.id}.${ext}`;
    const buffer = await file.arrayBuffer();

    const { error } = await supabaseAdmin.storage
      .from("media")
      .upload(path, buffer, { contentType: file.type, upsert: true });

    if (error) {
      throw new HTTPException(500, { message: "Failed to upload avatar" });
    }

    const { data: urlData } = supabaseAdmin.storage
      .from("media")
      .getPublicUrl(path);

    const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    await db
      .update(studentProfiles)
      .set({ avatarUrl })
      .where(eq(studentProfiles.id, user.id));

    return c.json({ success: true, data: { avatarUrl } });
  })

  .patch("/me", zValidator("json", updateProfileSchema, validationHook), async (c) => {
    const user = c.get("user");
    const updates = c.req.valid("json");

    if (updates.fullName !== undefined) {
      await db
        .update(profiles)
        .set({ fullName: updates.fullName, updatedAt: sql`now()` })
        .where(eq(profiles.id, user.id));
    }

    const studentUpdates: Record<string, unknown> = {};
    if (updates.faculty !== undefined) studentUpdates.faculty = updates.faculty;
    if (updates.group !== undefined) studentUpdates.group = updates.group;
    if (updates.bio !== undefined) studentUpdates.bio = updates.bio;
    if (updates.interests !== undefined) studentUpdates.interests = updates.interests;
    if (updates.avatarUrl !== undefined) studentUpdates.avatarUrl = updates.avatarUrl;

    if (Object.keys(studentUpdates).length > 0) {
      await db
        .update(studentProfiles)
        .set(studentUpdates)
        .where(eq(studentProfiles.id, user.id));
    }

    const [profile] = await db
      .select({
        id: profiles.id,
        email: profiles.email,
        fullName: profiles.fullName,
        role: profiles.role,
        status: profiles.status,
        createdAt: profiles.createdAt,
        faculty: studentProfiles.faculty,
        group: studentProfiles.group,
        avatarUrl: studentProfiles.avatarUrl,
        bio: studentProfiles.bio,
        interests: studentProfiles.interests,
      })
      .from(profiles)
      .leftJoin(studentProfiles, eq(profiles.id, studentProfiles.id))
      .where(eq(profiles.id, user.id))
      .limit(1);

    return c.json({ success: true, data: profile });
  });

export default app;
