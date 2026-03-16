import { sql } from "drizzle-orm";
import {
  foreignKey,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { authenticatedRole, authUid, authUsers } from "drizzle-orm/supabase";

export const roleEnum = pgEnum("user_role", ["admin", "student"]);
export const statusEnum = pgEnum("user_status", [
  "pending",
  "approved",
  "rejected",
]);

export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey(),
    email: text("email").notNull().unique(),
    fullName: text("full_name"),
    role: roleEnum("role").notNull().default("student"),
    status: statusEnum("status").notNull().default("pending"),
    group: text("group"),
    avatarUrl: text("avatar_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // FK to Supabase auth.users
    foreignKey({
      columns: [table.id],
      foreignColumns: [authUsers.id],
      name: "profiles_id_auth_users_fk",
    }).onDelete("cascade"),

    // --- SELECT policies ---
    pgPolicy("admins_read_all_profiles", {
      for: "select",
      to: authenticatedRole,
      using: sql`public.is_admin()`,
    }),

    pgPolicy("users_read_own_profile", {
      for: "select",
      to: authenticatedRole,
      using: sql`${table.id} = ${authUid}`,
    }),

    // --- UPDATE policies ---
    pgPolicy("admins_update_profiles", {
      for: "update",
      to: authenticatedRole,
      using: sql`public.is_admin()`,
      withCheck: sql`public.is_admin()`,
    }),

    pgPolicy("students_update_own_profile", {
      for: "update",
      to: authenticatedRole,
      using: sql`${table.id} = ${authUid} AND ${table.role} = 'student' AND ${table.status} = 'approved'`,
      withCheck: sql`${table.id} = ${authUid} AND ${table.role} = 'student' AND ${table.status} = 'approved'`,
    }),
  ],
);
