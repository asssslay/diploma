import { zValidator } from "@hono/zod-validator";
import { HTTPException } from "hono/http-exception";
import { count, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@my-better-t-app/db";
import {
  profiles,
  studentApplications,
  studentProfiles,
} from "@my-better-t-app/db/schema";
import { createRouter } from "@/lib/app";
import { adminOnly, auth } from "@/middleware/auth";
import { validationHook } from "@/lib/zod-hook";

const idParamSchema = z.object({
  id: z.string().uuid(),
});

const listQuerySchema = z.object({
  status: z.enum(["pending", "approved", "rejected"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(10),
});

const rejectBodySchema = z.object({
  reason: z.string().min(1).max(500),
});

const app = createRouter()
  .use("/*", auth, adminOnly)

  .get("/", zValidator("query", listQuerySchema, validationHook), async (c) => {
    const { status, page, pageSize } = c.req.valid("query");
    const offset = (page - 1) * pageSize;

    const where = status ? eq(profiles.status, status) : undefined;

    const [items, [total]] = await Promise.all([
      db
        .select({
          id: profiles.id,
          email: profiles.email,
          fullName: profiles.fullName,
          status: profiles.status,
          createdAt: profiles.createdAt,
          group: studentProfiles.group,
          faculty: studentProfiles.faculty,
          reviewedAt: studentApplications.reviewedAt,
          rejectionReason: studentApplications.rejectionReason,
        })
        .from(studentApplications)
        .innerJoin(profiles, eq(studentApplications.id, profiles.id))
        .innerJoin(studentProfiles, eq(studentApplications.id, studentProfiles.id))
        .where(where)
        .orderBy(desc(profiles.createdAt))
        .limit(pageSize)
        .offset(offset),

      db
        .select({ value: count() })
        .from(studentApplications)
        .innerJoin(profiles, eq(studentApplications.id, profiles.id))
        .where(where),
    ]);

    return c.json({
      success: true,
      data: items,
      total: total?.value ?? 0,
      page,
      pageSize,
    });
  })

  .get("/:id", zValidator("param", idParamSchema, validationHook), async (c) => {
    const { id } = c.req.valid("param");

    const [application] = await db
      .select({
        id: profiles.id,
        email: profiles.email,
        fullName: profiles.fullName,
        status: profiles.status,
        createdAt: profiles.createdAt,
        group: studentProfiles.group,
        faculty: studentProfiles.faculty,
        bio: studentProfiles.bio,
        interests: studentProfiles.interests,
        reviewedBy: studentApplications.reviewedBy,
        reviewedAt: studentApplications.reviewedAt,
        rejectionReason: studentApplications.rejectionReason,
      })
      .from(studentApplications)
      .innerJoin(profiles, eq(studentApplications.id, profiles.id))
      .innerJoin(studentProfiles, eq(studentApplications.id, studentProfiles.id))
      .where(eq(studentApplications.id, id))
      .limit(1);

    if (!application) {
      throw new HTTPException(404, { message: "Application not found" });
    }

    return c.json({ success: true, data: application });
  })

  .patch("/:id/approve", zValidator("param", idParamSchema, validationHook), async (c) => {
    const { id } = c.req.valid("param");
    const admin = c.get("profile");

    const [application] = await db
      .select({ id: studentApplications.id, status: profiles.status })
      .from(studentApplications)
      .innerJoin(profiles, eq(studentApplications.id, profiles.id))
      .where(eq(studentApplications.id, id))
      .limit(1);

    if (!application) {
      throw new HTTPException(404, { message: "Application not found" });
    }

    if (application.status !== "pending") {
      throw new HTTPException(409, {
        message: `Application is already ${application.status}`,
      });
    }

    await db.transaction(async (tx) => {
      await tx
        .update(profiles)
        .set({ status: "approved", updatedAt: sql`now()` })
        .where(eq(profiles.id, id));

      await tx
        .update(studentApplications)
        .set({ reviewedBy: admin.id, reviewedAt: sql`now()` })
        .where(eq(studentApplications.id, id));
    });

    return c.json({
      success: true,
      data: { id, status: "approved" },
    });
  })

  .patch(
    "/:id/reject",
    zValidator("param", idParamSchema, validationHook),
    zValidator("json", rejectBodySchema, validationHook),
    async (c) => {
      const { id } = c.req.valid("param");
      const admin = c.get("profile");
      const { reason } = c.req.valid("json");

      const [application] = await db
        .select({ id: studentApplications.id, status: profiles.status })
        .from(studentApplications)
        .innerJoin(profiles, eq(studentApplications.id, profiles.id))
        .where(eq(studentApplications.id, id))
        .limit(1);

      if (!application) {
        throw new HTTPException(404, { message: "Application not found" });
      }

      if (application.status !== "pending") {
        throw new HTTPException(409, {
          message: `Application is already ${application.status}`,
        });
      }

      await db.transaction(async (tx) => {
        await tx
          .update(profiles)
          .set({ status: "rejected", updatedAt: sql`now()` })
          .where(eq(profiles.id, id));

        await tx
          .update(studentApplications)
          .set({
            reviewedBy: admin.id,
            reviewedAt: sql`now()`,
            rejectionReason: reason,
          })
          .where(eq(studentApplications.id, id));
      });

      return c.json({
        success: true,
        data: { id, status: "rejected" },
      });
    },
  );

export default app;
