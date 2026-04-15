import { sql } from "drizzle-orm";
import {
  foreignKey,
  integer,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  unique,
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

export const studentProfiles = pgTable(
  "student_profiles",
  {
    id: uuid("id").primaryKey(),
    faculty: text("faculty"),
    group: text("group"),
    avatarUrl: text("avatar_url"),
    backgroundUrl: text("background_url"),
    bio: text("bio"),
    interests: text("interests").array().notNull().default(sql`'{}'`),
  },
  (table) => [
    foreignKey({
      columns: [table.id],
      foreignColumns: [profiles.id],
      name: "student_profiles_id_profiles_fk",
    }).onDelete("cascade"),

    // --- SELECT policies ---
    pgPolicy("authenticated_read_student_profiles", {
      for: "select",
      to: authenticatedRole,
      using: sql`true`,
    }),

    // --- UPDATE policies ---
    pgPolicy("admins_update_student_profiles", {
      for: "update",
      to: authenticatedRole,
      using: sql`public.is_admin()`,
      withCheck: sql`public.is_admin()`,
    }),

    pgPolicy("students_update_own_student_profile", {
      for: "update",
      to: authenticatedRole,
      using: sql`${table.id} = ${authUid}`,
      withCheck: sql`${table.id} = ${authUid}`,
    }),
  ],
);

export const studentApplications = pgTable(
  "student_applications",
  {
    id: uuid("id").primaryKey(),
    reviewedBy: uuid("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    rejectionReason: text("rejection_reason"),
  },
  (table) => [
    foreignKey({
      columns: [table.id],
      foreignColumns: [profiles.id],
      name: "student_applications_id_profiles_fk",
    }).onDelete("cascade"),

    foreignKey({
      columns: [table.reviewedBy],
      foreignColumns: [profiles.id],
      name: "student_applications_reviewed_by_profiles_fk",
    }).onDelete("set null"),

    // --- SELECT policies ---
    pgPolicy("admins_read_all_applications", {
      for: "select",
      to: authenticatedRole,
      using: sql`public.is_admin()`,
    }),

    pgPolicy("students_read_own_application", {
      for: "select",
      to: authenticatedRole,
      using: sql`${table.id} = ${authUid}`,
    }),

    // --- UPDATE policies ---
    pgPolicy("admins_update_applications", {
      for: "update",
      to: authenticatedRole,
      using: sql`public.is_admin()`,
      withCheck: sql`public.is_admin()`,
    }),
  ],
);

export const userSettings = pgTable("user_settings", {
  id: uuid("id").primaryKey(),
});

export const newsPosts = pgTable(
  "news_posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    imageUrl: text("image_url"),
    authorId: uuid("author_id"),
    publishedAt: timestamp("published_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    viewCount: integer("view_count").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.authorId],
      foreignColumns: [profiles.id],
      name: "news_posts_author_id_profiles_fk",
    }).onDelete("set null"),

    // --- SELECT policies ---
    pgPolicy("admins_manage_news", {
      for: "select",
      to: authenticatedRole,
      using: sql`public.is_admin()`,
    }),

    pgPolicy("authenticated_read_news", {
      for: "select",
      to: authenticatedRole,
      using: sql`true`,
    }),

    // --- INSERT policies ---
    pgPolicy("admins_insert_news", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`public.is_admin()`,
    }),

    // --- UPDATE policies ---
    pgPolicy("admins_update_news", {
      for: "update",
      to: authenticatedRole,
      using: sql`public.is_admin()`,
      withCheck: sql`public.is_admin()`,
    }),

    // --- DELETE policies ---
    pgPolicy("admins_delete_news", {
      for: "delete",
      to: authenticatedRole,
      using: sql`public.is_admin()`,
    }),
  ],
);

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    imageUrl: text("image_url"),
    authorId: uuid("author_id"),
    eventDate: timestamp("event_date", { withTimezone: true }).notNull(),
    location: text("location").notNull(),
    maxParticipants: integer("max_participants").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.authorId],
      foreignColumns: [profiles.id],
      name: "events_author_id_profiles_fk",
    }).onDelete("set null"),

    // --- SELECT policies ---
    pgPolicy("admins_manage_events", {
      for: "select",
      to: authenticatedRole,
      using: sql`public.is_admin()`,
    }),

    pgPolicy("authenticated_read_events", {
      for: "select",
      to: authenticatedRole,
      using: sql`true`,
    }),

    // --- INSERT policies ---
    pgPolicy("admins_insert_events", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`public.is_admin()`,
    }),

    // --- UPDATE policies ---
    pgPolicy("admins_update_events", {
      for: "update",
      to: authenticatedRole,
      using: sql`public.is_admin()`,
      withCheck: sql`public.is_admin()`,
    }),

    // --- DELETE policies ---
    pgPolicy("admins_delete_events", {
      for: "delete",
      to: authenticatedRole,
      using: sql`public.is_admin()`,
    }),
  ],
);

export const eventRegistrations = pgTable(
  "event_registrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id").notNull(),
    studentId: uuid("student_id").notNull(),
    reminder24hEmailId: text("reminder_24h_email_id"),
    reminder1hEmailId: text("reminder_1h_email_id"),
    registeredAt: timestamp("registered_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.eventId],
      foreignColumns: [events.id],
      name: "event_registrations_event_id_events_fk",
    }).onDelete("cascade"),

    foreignKey({
      columns: [table.studentId],
      foreignColumns: [profiles.id],
      name: "event_registrations_student_id_profiles_fk",
    }).onDelete("cascade"),

    unique("event_registrations_event_student_unique").on(
      table.eventId,
      table.studentId,
    ),

    // --- SELECT policies ---
    pgPolicy("admins_read_all_registrations", {
      for: "select",
      to: authenticatedRole,
      using: sql`public.is_admin()`,
    }),

    pgPolicy("students_read_own_registrations", {
      for: "select",
      to: authenticatedRole,
      using: sql`${table.studentId} = ${authUid}`,
    }),

    // --- INSERT policies ---
    pgPolicy("students_insert_own_registration", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${table.studentId} = ${authUid}`,
    }),

    // --- DELETE policies ---
    pgPolicy("students_delete_own_registration", {
      for: "delete",
      to: authenticatedRole,
      using: sql`${table.studentId} = ${authUid}`,
    }),
  ],
);

export const discussionCategoryEnum = pgEnum("discussion_category", [
  "general",
  "academic",
  "social",
  "help",
  "feedback",
]);

export const discussions = pgTable(
  "discussions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    category: discussionCategoryEnum("category").notNull(),
    authorId: uuid("author_id").notNull(),
    viewCount: integer("view_count").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.authorId],
      foreignColumns: [profiles.id],
      name: "discussions_author_id_profiles_fk",
    }).onDelete("cascade"),

    // --- SELECT policies ---
    pgPolicy("authenticated_read_discussions", {
      for: "select",
      to: authenticatedRole,
      using: sql`true`,
    }),

    // --- INSERT policies ---
    pgPolicy("students_insert_own_discussion", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${table.authorId} = ${authUid}`,
    }),

    // --- UPDATE policies ---
    pgPolicy("students_update_own_discussion", {
      for: "update",
      to: authenticatedRole,
      using: sql`${table.authorId} = ${authUid}`,
      withCheck: sql`${table.authorId} = ${authUid}`,
    }),

    // --- DELETE policies ---
    pgPolicy("admins_delete_discussions", {
      for: "delete",
      to: authenticatedRole,
      using: sql`public.is_admin()`,
    }),
  ],
);

export const discussionComments = pgTable(
  "discussion_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    discussionId: uuid("discussion_id").notNull(),
    authorId: uuid("author_id").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.discussionId],
      foreignColumns: [discussions.id],
      name: "discussion_comments_discussion_id_fk",
    }).onDelete("cascade"),

    foreignKey({
      columns: [table.authorId],
      foreignColumns: [profiles.id],
      name: "discussion_comments_author_id_profiles_fk",
    }).onDelete("cascade"),

    // --- SELECT policies ---
    pgPolicy("authenticated_read_discussion_comments", {
      for: "select",
      to: authenticatedRole,
      using: sql`true`,
    }),

    // --- INSERT policies ---
    pgPolicy("students_insert_own_comment", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${table.authorId} = ${authUid}`,
    }),

    // --- UPDATE policies ---
    pgPolicy("students_update_own_comment", {
      for: "update",
      to: authenticatedRole,
      using: sql`${table.authorId} = ${authUid}`,
      withCheck: sql`${table.authorId} = ${authUid}`,
    }),

    // --- DELETE policies ---
    pgPolicy("students_delete_own_comment", {
      for: "delete",
      to: authenticatedRole,
      using: sql`${table.authorId} = ${authUid}`,
    }),

    pgPolicy("admins_delete_comments", {
      for: "delete",
      to: authenticatedRole,
      using: sql`public.is_admin()`,
    }),
  ],
);

export const discussionReactions = pgTable(
  "discussion_reactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    discussionId: uuid("discussion_id").notNull(),
    userId: uuid("user_id").notNull(),
    type: text("type").notNull().default("like"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.discussionId],
      foreignColumns: [discussions.id],
      name: "discussion_reactions_discussion_id_fk",
    }).onDelete("cascade"),

    foreignKey({
      columns: [table.userId],
      foreignColumns: [profiles.id],
      name: "discussion_reactions_user_id_profiles_fk",
    }).onDelete("cascade"),

    unique("discussion_reactions_unique").on(
      table.discussionId,
      table.userId,
      table.type,
    ),

    // --- SELECT policies ---
    pgPolicy("authenticated_read_discussion_reactions", {
      for: "select",
      to: authenticatedRole,
      using: sql`true`,
    }),

    // --- INSERT policies ---
    pgPolicy("students_insert_own_reaction", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${table.userId} = ${authUid}`,
    }),

    // --- DELETE policies ---
    pgPolicy("students_delete_own_reaction", {
      for: "delete",
      to: authenticatedRole,
      using: sql`${table.userId} = ${authUid}`,
    }),
  ],
);

export const commentReactions = pgTable(
  "comment_reactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    commentId: uuid("comment_id").notNull(),
    userId: uuid("user_id").notNull(),
    type: text("type").notNull().default("like"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.commentId],
      foreignColumns: [discussionComments.id],
      name: "comment_reactions_comment_id_fk",
    }).onDelete("cascade"),

    foreignKey({
      columns: [table.userId],
      foreignColumns: [profiles.id],
      name: "comment_reactions_user_id_profiles_fk",
    }).onDelete("cascade"),

    unique("comment_reactions_unique").on(
      table.commentId,
      table.userId,
      table.type,
    ),

    // --- SELECT policies ---
    pgPolicy("authenticated_read_comment_reactions", {
      for: "select",
      to: authenticatedRole,
      using: sql`true`,
    }),

    // --- INSERT policies ---
    pgPolicy("students_insert_own_comment_reaction", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${table.userId} = ${authUid}`,
    }),

    // --- DELETE policies ---
    pgPolicy("students_delete_own_comment_reaction", {
      for: "delete",
      to: authenticatedRole,
      using: sql`${table.userId} = ${authUid}`,
    }),
  ],
);

export const notes = pgTable(
  "notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [profiles.id],
      name: "notes_user_id_profiles_fk",
    }).onDelete("cascade"),

    pgPolicy("owner_read_own_notes", {
      for: "select",
      to: authenticatedRole,
      using: sql`${table.userId} = ${authUid}`,
    }),
    pgPolicy("owner_insert_own_notes", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${table.userId} = ${authUid}`,
    }),
    pgPolicy("owner_update_own_notes", {
      for: "update",
      to: authenticatedRole,
      using: sql`${table.userId} = ${authUid}`,
      withCheck: sql`${table.userId} = ${authUid}`,
    }),
    pgPolicy("owner_delete_own_notes", {
      for: "delete",
      to: authenticatedRole,
      using: sql`${table.userId} = ${authUid}`,
    }),
  ],
);

export const deadlines = pgTable(
  "deadlines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    title: text("title").notNull(),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    reminder24hEmailId: text("reminder_24h_email_id"),
    reminder1hEmailId: text("reminder_1h_email_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [profiles.id],
      name: "deadlines_user_id_profiles_fk",
    }).onDelete("cascade"),

    pgPolicy("owner_read_own_deadlines", {
      for: "select",
      to: authenticatedRole,
      using: sql`${table.userId} = ${authUid}`,
    }),
    pgPolicy("owner_insert_own_deadlines", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${table.userId} = ${authUid}`,
    }),
    pgPolicy("owner_update_own_deadlines", {
      for: "update",
      to: authenticatedRole,
      using: sql`${table.userId} = ${authUid}`,
      withCheck: sql`${table.userId} = ${authUid}`,
    }),
    pgPolicy("owner_delete_own_deadlines", {
      for: "delete",
      to: authenticatedRole,
      using: sql`${table.userId} = ${authUid}`,
    }),
  ],
);
