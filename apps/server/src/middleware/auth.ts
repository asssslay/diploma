import { supabaseAdmin } from "@my-better-t-app/db/supabase-admin";
import { createAppMiddleware } from "@/lib/app";
import { verifyAccessToken } from "@/lib/verify-access-token";

export const auth = createAppMiddleware(async (c, next) => {
  const header = c.req.header("Authorization");

  if (!header?.startsWith("Bearer ")) {
    return c.json(
      { success: false, error: "Missing or invalid authorization token" },
      401,
    );
  }

  const token = header.slice(7);
  const user = await verifyAccessToken(token);

  if (!user) {
    return c.json(
      { success: false, error: "Missing or invalid authorization token" },
      401,
    );
  }

  c.set("user", user);
  await next();
});

export const adminOnly = createAppMiddleware(async (c, next) => {
  const user = c.get("user");

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, role, status")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return c.json({ success: false, error: "Admin access required" }, 403);
  }

  c.set("profile", profile as { id: string; role: "admin" | "student"; status: "pending" | "approved" | "rejected" });
  await next();
});
