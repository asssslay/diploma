import { zValidator } from "@hono/zod-validator";
import { HTTPException } from "hono/http-exception";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@my-better-t-app/db";
import { profiles, studentProfiles } from "@my-better-t-app/db/schema";
import { createRouter } from "@/lib/app";
import { auth } from "@/middleware/auth";
import { validationHook } from "@/lib/zod-hook";

const idParamSchema = z.object({
  id: z.string().uuid(),
});

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
  });

export default app;
