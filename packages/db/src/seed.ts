import dotenv from "dotenv";
dotenv.config({ path: "../../.env" });

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { profiles } from "./schema";
import { createClient } from "@supabase/supabase-js";

/**
 * Seeds or updates the initial admin account.
 *
 * Usage:
 *   ADMIN_PASSWORD=yourpassword pnpm db:seed
 *
 * Optional env vars:
 *   ADMIN_EMAIL
 *   ADMIN_FULL_NAME
 *
 * Required env vars from the repo .env:
 *   DATABASE_URL
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */
// Allow the seed script to run directly from the package while reading the repo-level env file.
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@university.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_FULL_NAME = process.env.ADMIN_FULL_NAME ?? "System Administrator";

if (!ADMIN_PASSWORD) {
  console.error("ADMIN_PASSWORD env variable is required.");
  console.error("Usage: ADMIN_PASSWORD=yourpassword pnpm db:seed");
  process.exit(1);
}

if (ADMIN_PASSWORD.length < 8) {
  console.error("ADMIN_PASSWORD must be at least 8 characters.");
  process.exit(1);
}

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client);

try {
  // Seeding is intentionally idempotent: create the auth user when missing, otherwise update the existing admin.
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: ADMIN_FULL_NAME },
  });

  let userId: string;

  if (error) {
    const { data: existing } = await supabaseAdmin.auth.admin
      .listUsers({ filter: `email:eq:${ADMIN_EMAIL}`, page: 1, perPage: 1 });

    if (!existing.users.length) throw error;

    userId = existing.users[0].id;
    console.log("Admin auth user already exists, updating...");

    await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: ADMIN_PASSWORD,
      email_confirm: true,
    });
  } else {
    userId = data.user.id;
  }

  // The auth user and app profile live in different systems, so the profile role/status must be enforced separately.
  await db
    .update(profiles)
    .set({ role: "admin", status: "approved", fullName: ADMIN_FULL_NAME })
    .where(eq(profiles.id, userId));

  console.log(`Admin seeded: ${ADMIN_EMAIL}`);
} finally {
  // Always close the raw postgres client so one-off seed runs do not hang the process.
  await client.end();
}
