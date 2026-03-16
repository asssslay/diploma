import dotenv from "dotenv";
dotenv.config({ path: "../../.env" });

const { eq } = await import("drizzle-orm");
const { drizzle } = await import("drizzle-orm/postgres-js");
const { default: postgres } = await import("postgres");
const { profiles } = await import("./schema");
const { createClient } = await import("@supabase/supabase-js");

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

  await db
    .update(profiles)
    .set({ role: "admin", status: "approved", fullName: ADMIN_FULL_NAME })
    .where(eq(profiles.id, userId));

  console.log(`Admin seeded: ${ADMIN_EMAIL}`);
} finally {
  await client.end();
}
