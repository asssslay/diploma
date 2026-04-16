# Settings Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/settings` page where students can toggle email notifications for deadline and event reminders, with changes persisted and affecting system behavior (cancel/schedule Resend emails).

**Architecture:** Dedicated `routes/settings.ts` with GET (lazy-create) and PATCH (transition detection + awaited bulk operations). Domain helpers in `deadline-reminders.ts` and `event-reminders.ts` handle throttled Resend API calls. Frontend uses shadcn Switch with disabled-during-save UX.

**Tech Stack:** Drizzle ORM, Hono, Zod, Resend, React, TanStack Router, shadcn/ui

**Spec:** `docs/superpowers/specs/2026-04-16-settings-page-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `packages/db/src/schema.ts` | Modify | Extend `userSettings` with boolean columns + FK + RLS |
| `apps/server/src/lib/throttle.ts` | Create | Shared `runThrottled` utility |
| `apps/server/src/lib/deadline-reminders.ts` | Create | User-scoped bulk cancel/schedule for deadlines |
| `apps/server/src/lib/event-reminders.ts` | Modify | Add user-scoped helpers, update `rescheduleAll` to respect prefs, import from throttle |
| `apps/server/src/routes/settings.ts` | Create | GET + PATCH endpoints for user settings |
| `apps/server/src/index.ts` | Modify | Mount `/api/settings` route |
| `apps/server/src/routes/deadlines.ts` | Modify | Gate scheduling on user prefs |
| `apps/server/src/routes/events.ts` | Modify | Gate scheduling on user prefs |
| `apps/web/src/components/ui/switch.tsx` | Create | Install shadcn Switch component |
| `apps/web/src/components/student-sidebar.tsx` | Modify | Add Settings nav item |
| `apps/web/src/routes/_student/settings.tsx` | Create | Settings page with notification toggles |

---

### Task 1: Extend `userSettings` schema and run migration

**Files:**
- Modify: `packages/db/src/schema.ts:1-13` (imports) and `packages/db/src/schema.ts:161-163` (userSettings table)

- [ ] **Step 1: Add `boolean` to drizzle imports**

In `packages/db/src/schema.ts`, add `boolean` to the import from `drizzle-orm/pg-core`:

```ts
import {
  boolean,
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
```

- [ ] **Step 2: Replace the `userSettings` placeholder**

Replace the current placeholder (lines 161-163):

```ts
export const userSettings = pgTable("user_settings", {
  id: uuid("id").primaryKey(),
});
```

With the full table definition:

```ts
export const userSettings = pgTable(
  "user_settings",
  {
    id: uuid("id").primaryKey(),
    notifyDeadlineReminders: boolean("notify_deadline_reminders")
      .notNull()
      .default(true),
    notifyEventReminders: boolean("notify_event_reminders")
      .notNull()
      .default(true),
  },
  (table) => [
    foreignKey({
      columns: [table.id],
      foreignColumns: [profiles.id],
      name: "user_settings_id_profiles_fk",
    }).onDelete("cascade"),

    pgPolicy("owner_read_own_settings", {
      for: "select",
      to: authenticatedRole,
      using: sql`${table.id} = ${authUid}`,
    }),
    pgPolicy("owner_insert_own_settings", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${table.id} = ${authUid}`,
    }),
    pgPolicy("owner_update_own_settings", {
      for: "update",
      to: authenticatedRole,
      using: sql`${table.id} = ${authUid}`,
      withCheck: sql`${table.id} = ${authUid}`,
    }),
  ],
);
```

- [ ] **Step 3: Generate and apply migration**

```bash
cd packages/db && npx drizzle-kit generate && npx drizzle-kit migrate
```

Expected: Migration SQL adds `notify_deadline_reminders` and `notify_event_reminders` boolean columns with defaults, FK constraint, and RLS policies to `user_settings`.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/schema.ts packages/db/drizzle/
git commit -m "feat(db): extend userSettings with notification preferences"
```

---

### Task 2: Extract `runThrottled` into shared utility

**Files:**
- Create: `apps/server/src/lib/throttle.ts`
- Modify: `apps/server/src/lib/event-reminders.ts:1-30`

- [ ] **Step 1: Create `lib/throttle.ts`**

Create `apps/server/src/lib/throttle.ts`:

```ts
/**
 * Executes async tasks sequentially with a rate limit.
 * Designed to stay under Resend's 5 rps team limit.
 */
export async function runThrottled<T>(
  tasks: Array<() => Promise<T>>,
  ratePerSecond = 4,
): Promise<T[]> {
  const results: T[] = [];
  const intervalMs = Math.ceil(1000 / ratePerSecond);
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    if (!task) continue;
    results.push(await task());
    if (i < tasks.length - 1) {
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
  return results;
}
```

- [ ] **Step 2: Update `event-reminders.ts` to import from `throttle.ts`**

In `apps/server/src/lib/event-reminders.ts`, remove the local `runThrottled` function (lines 14-30) and add the import:

Replace:
```ts
import { eq } from "drizzle-orm";
import { db } from "@my-better-t-app/db";
import { eventRegistrations, profiles } from "@my-better-t-app/db/schema";
import {
  cancelScheduledEmail,
  scheduleEventReminder,
} from "@/lib/emails";

export type EventReminderIds = {
  reminder24hEmailId: string | null;
  reminder1hEmailId: string | null;
};

// Throttle async tasks to respect Resend's 5 rps team limit.
async function runThrottled<T>(
  tasks: Array<() => Promise<T>>,
  ratePerSecond = 4,
): Promise<T[]> {
  const results: T[] = [];
  const intervalMs = Math.ceil(1000 / ratePerSecond);
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    if (!task) continue;
    results.push(await task());
    if (i < tasks.length - 1) {
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
  return results;
}
```

With:
```ts
import { eq } from "drizzle-orm";
import { db } from "@my-better-t-app/db";
import { eventRegistrations, profiles } from "@my-better-t-app/db/schema";
import {
  cancelScheduledEmail,
  scheduleEventReminder,
} from "@/lib/emails";
import { runThrottled } from "@/lib/throttle";

export type EventReminderIds = {
  reminder24hEmailId: string | null;
  reminder1hEmailId: string | null;
};
```

- [ ] **Step 3: Verify server type-check**

```bash
cd apps/server && npx tsc --noEmit
```

Expected: No errors. All existing `runThrottled` call sites in `event-reminders.ts` now resolve to the shared import.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/lib/throttle.ts apps/server/src/lib/event-reminders.ts
git commit -m "refactor: extract runThrottled into shared lib/throttle.ts"
```

---

### Task 3: Create deadline reminder helpers

**Files:**
- Create: `apps/server/src/lib/deadline-reminders.ts`

- [ ] **Step 1: Create `lib/deadline-reminders.ts`**

Create `apps/server/src/lib/deadline-reminders.ts`:

```ts
import { and, eq, gt } from "drizzle-orm";
import { db } from "@my-better-t-app/db";
import { deadlines, profiles } from "@my-better-t-app/db/schema";
import {
  cancelScheduledEmail,
  scheduleDeadlineReminder,
} from "@/lib/emails";
import { runThrottled } from "@/lib/throttle";

/**
 * Cancels all scheduled deadline reminders for a user and nulls out
 * the stored Resend IDs. Called when the user disables deadline notifications.
 */
export async function cancelAllUserDeadlineReminders(
  userId: string,
): Promise<void> {
  const rows = await db
    .select({
      id: deadlines.id,
      reminder24hEmailId: deadlines.reminder24hEmailId,
      reminder1hEmailId: deadlines.reminder1hEmailId,
    })
    .from(deadlines)
    .where(eq(deadlines.userId, userId));

  const cancelTasks: Array<() => Promise<boolean>> = [];
  for (const row of rows) {
    if (row.reminder24hEmailId) {
      const emailId = row.reminder24hEmailId;
      cancelTasks.push(() => cancelScheduledEmail(emailId));
    }
    if (row.reminder1hEmailId) {
      const emailId = row.reminder1hEmailId;
      cancelTasks.push(() => cancelScheduledEmail(emailId));
    }
  }

  if (cancelTasks.length > 0) {
    console.log(
      `[deadlines] Cancelling ${cancelTasks.length} reminders for user=${userId}`,
    );
    await runThrottled(cancelTasks);
  }

  await db
    .update(deadlines)
    .set({ reminder24hEmailId: null, reminder1hEmailId: null })
    .where(eq(deadlines.userId, userId));
}

/**
 * Schedules reminders (24h + 1h) for all upcoming deadlines of a user.
 * Called when the user re-enables deadline notifications.
 */
export async function scheduleAllUserDeadlineReminders(
  userId: string,
): Promise<void> {
  const [userRow] = await db
    .select({ email: profiles.email })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  if (!userRow?.email) return;

  const rows = await db
    .select({
      id: deadlines.id,
      title: deadlines.title,
      dueAt: deadlines.dueAt,
    })
    .from(deadlines)
    .where(and(eq(deadlines.userId, userId), gt(deadlines.dueAt, new Date())));

  if (rows.length === 0) return;

  console.log(
    `[deadlines] Scheduling reminders for ${rows.length} deadlines for user=${userId}`,
  );

  const tasks = rows.map((row) => async () => {
    try {
      const operationId = crypto.randomUUID();
      const [reminder24hEmailId, reminder1hEmailId] = await Promise.all([
        scheduleDeadlineReminder(
          userRow.email,
          row.title,
          row.dueAt,
          24,
          operationId,
        ),
        scheduleDeadlineReminder(
          userRow.email,
          row.title,
          row.dueAt,
          1,
          operationId,
        ),
      ]);

      await db
        .update(deadlines)
        .set({ reminder24hEmailId, reminder1hEmailId })
        .where(eq(deadlines.id, row.id));
    } catch (err) {
      console.error(
        `[deadlines] Failed to schedule reminders for deadline=${row.id}:`,
        err,
      );
    }
  });

  await runThrottled(tasks);
}
```

- [ ] **Step 2: Verify server type-check**

```bash
cd apps/server && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/lib/deadline-reminders.ts
git commit -m "feat: add user-scoped bulk deadline reminder helpers"
```

---

### Task 4: Add user-scoped event reminder helpers and update `rescheduleAll`

**Files:**
- Modify: `apps/server/src/lib/event-reminders.ts`

- [ ] **Step 1: Update imports**

In `apps/server/src/lib/event-reminders.ts`, update the imports to include the additional modules needed:

Replace:
```ts
import { eq } from "drizzle-orm";
import { db } from "@my-better-t-app/db";
import { eventRegistrations, profiles } from "@my-better-t-app/db/schema";
```

With:
```ts
import { and, eq, gt } from "drizzle-orm";
import { db } from "@my-better-t-app/db";
import {
  eventRegistrations,
  events,
  profiles,
  userSettings,
} from "@my-better-t-app/db/schema";
```

- [ ] **Step 2: Update `rescheduleAllEventReminders` to respect user notification preferences**

In the `rescheduleAllEventReminders` function, update the SELECT query to join `userSettings`:

Replace the existing query (the `.select(...)` through `.where(...)` block):
```ts
  const rows = await db
    .select({
      registrationId: eventRegistrations.id,
      studentId: eventRegistrations.studentId,
      email: profiles.email,
      reminder24hEmailId: eventRegistrations.reminder24hEmailId,
      reminder1hEmailId: eventRegistrations.reminder1hEmailId,
    })
    .from(eventRegistrations)
    .innerJoin(profiles, eq(eventRegistrations.studentId, profiles.id))
    .where(eq(eventRegistrations.eventId, eventId));
```

With:
```ts
  const rows = await db
    .select({
      registrationId: eventRegistrations.id,
      studentId: eventRegistrations.studentId,
      email: profiles.email,
      reminder24hEmailId: eventRegistrations.reminder24hEmailId,
      reminder1hEmailId: eventRegistrations.reminder1hEmailId,
      notifyEventReminders: userSettings.notifyEventReminders,
    })
    .from(eventRegistrations)
    .innerJoin(profiles, eq(eventRegistrations.studentId, profiles.id))
    .leftJoin(userSettings, eq(eventRegistrations.studentId, userSettings.id))
    .where(eq(eventRegistrations.eventId, eventId));
```

Then, inside the per-row task function, add a check after `cancelBothEventReminders(row)`. Replace the existing task body:

```ts
  const tasks = rows.map((row) => async () => {
    try {
      await cancelBothEventReminders(row);

      if (!row.email) {
```

With:
```ts
  const tasks = rows.map((row) => async () => {
    try {
      await cancelBothEventReminders(row);

      // Respect user notification preferences (no row = default true)
      if (row.notifyEventReminders === false) {
        await db
          .update(eventRegistrations)
          .set({ reminder24hEmailId: null, reminder1hEmailId: null })
          .where(eq(eventRegistrations.id, row.registrationId));
        return;
      }

      if (!row.email) {
```

- [ ] **Step 3: Add `cancelAllUserEventReminders` function**

Append after the existing `rescheduleAllEventReminders` function:

```ts
/**
 * Cancels all scheduled event reminders for a user and nulls out
 * the stored Resend IDs. Called when the user disables event notifications.
 */
export async function cancelAllUserEventReminders(
  userId: string,
): Promise<void> {
  const rows = await db
    .select({
      id: eventRegistrations.id,
      reminder24hEmailId: eventRegistrations.reminder24hEmailId,
      reminder1hEmailId: eventRegistrations.reminder1hEmailId,
    })
    .from(eventRegistrations)
    .where(eq(eventRegistrations.studentId, userId));

  const cancelTasks: Array<() => Promise<boolean>> = [];
  for (const row of rows) {
    if (row.reminder24hEmailId) {
      const emailId = row.reminder24hEmailId;
      cancelTasks.push(() => cancelScheduledEmail(emailId));
    }
    if (row.reminder1hEmailId) {
      const emailId = row.reminder1hEmailId;
      cancelTasks.push(() => cancelScheduledEmail(emailId));
    }
  }

  if (cancelTasks.length > 0) {
    console.log(
      `[events] Cancelling ${cancelTasks.length} reminders for user=${userId}`,
    );
    await runThrottled(cancelTasks);
  }

  await db
    .update(eventRegistrations)
    .set({ reminder24hEmailId: null, reminder1hEmailId: null })
    .where(eq(eventRegistrations.studentId, userId));
}
```

- [ ] **Step 4: Add `scheduleAllUserEventReminders` function**

Append after `cancelAllUserEventReminders`:

```ts
/**
 * Schedules reminders (24h + 1h) for all upcoming event registrations of a user.
 * Called when the user re-enables event notifications.
 */
export async function scheduleAllUserEventReminders(
  userId: string,
): Promise<void> {
  const [userRow] = await db
    .select({ email: profiles.email })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  if (!userRow?.email) return;

  const rows = await db
    .select({
      registrationId: eventRegistrations.id,
      title: events.title,
      eventDate: events.eventDate,
      location: events.location,
    })
    .from(eventRegistrations)
    .innerJoin(events, eq(eventRegistrations.eventId, events.id))
    .where(
      and(
        eq(eventRegistrations.studentId, userId),
        gt(events.eventDate, new Date()),
      ),
    );

  if (rows.length === 0) return;

  console.log(
    `[events] Scheduling reminders for ${rows.length} event registrations for user=${userId}`,
  );

  const tasks = rows.map((row) => async () => {
    try {
      const operationId = crypto.randomUUID();
      const reminders = await scheduleBothEventReminders(
        userRow.email,
        row.title,
        row.eventDate,
        row.location,
        operationId,
      );

      await db
        .update(eventRegistrations)
        .set({
          reminder24hEmailId: reminders.reminder24hEmailId,
          reminder1hEmailId: reminders.reminder1hEmailId,
        })
        .where(eq(eventRegistrations.id, row.registrationId));
    } catch (err) {
      console.error(
        `[events] Failed to schedule reminders for registration=${row.registrationId}:`,
        err,
      );
    }
  });

  await runThrottled(tasks);
}
```

- [ ] **Step 5: Verify server type-check**

```bash
cd apps/server && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/lib/event-reminders.ts
git commit -m "feat: add user-scoped event reminder helpers, respect prefs in rescheduleAll"
```

---

### Task 5: Create settings route and mount it

**Files:**
- Create: `apps/server/src/routes/settings.ts`
- Modify: `apps/server/src/index.ts`

- [ ] **Step 1: Create `routes/settings.ts`**

Create `apps/server/src/routes/settings.ts`:

```ts
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@my-better-t-app/db";
import { userSettings } from "@my-better-t-app/db/schema";
import { createRouter } from "@/lib/app";
import { auth } from "@/middleware/auth";
import { validationHook } from "@/lib/zod-hook";
import {
  cancelAllUserDeadlineReminders,
  scheduleAllUserDeadlineReminders,
} from "@/lib/deadline-reminders";
import {
  cancelAllUserEventReminders,
  scheduleAllUserEventReminders,
} from "@/lib/event-reminders";

const updateSettingsSchema = z.object({
  notifyDeadlineReminders: z.boolean().optional(),
  notifyEventReminders: z.boolean().optional(),
});

async function getOrCreateSettings(userId: string) {
  await db
    .insert(userSettings)
    .values({
      id: userId,
      notifyDeadlineReminders: true,
      notifyEventReminders: true,
    })
    .onConflictDoNothing({ target: userSettings.id });

  const [settings] = await db
    .select({
      notifyDeadlineReminders: userSettings.notifyDeadlineReminders,
      notifyEventReminders: userSettings.notifyEventReminders,
    })
    .from(userSettings)
    .where(eq(userSettings.id, userId))
    .limit(1);

  return settings!;
}

const app = createRouter()
  .use("/*", auth)

  .get("/", async (c) => {
    const user = c.get("user");
    const settings = await getOrCreateSettings(user.id);

    return c.json({ success: true, data: settings });
  })

  .patch(
    "/",
    zValidator("json", updateSettingsSchema, validationHook),
    async (c) => {
      const user = c.get("user");
      const updates = c.req.valid("json");

      const current = await getOrCreateSettings(user.id);

      const setValues: Record<string, boolean> = {};
      if (updates.notifyDeadlineReminders !== undefined) {
        setValues.notifyDeadlineReminders = updates.notifyDeadlineReminders;
      }
      if (updates.notifyEventReminders !== undefined) {
        setValues.notifyEventReminders = updates.notifyEventReminders;
      }

      if (Object.keys(setValues).length > 0) {
        await db
          .update(userSettings)
          .set(setValues)
          .where(eq(userSettings.id, user.id));
      }

      // Detect transitions and perform bulk operations
      if (
        updates.notifyDeadlineReminders !== undefined &&
        updates.notifyDeadlineReminders !== current.notifyDeadlineReminders
      ) {
        if (updates.notifyDeadlineReminders) {
          await scheduleAllUserDeadlineReminders(user.id);
        } else {
          await cancelAllUserDeadlineReminders(user.id);
        }
      }

      if (
        updates.notifyEventReminders !== undefined &&
        updates.notifyEventReminders !== current.notifyEventReminders
      ) {
        if (updates.notifyEventReminders) {
          await scheduleAllUserEventReminders(user.id);
        } else {
          await cancelAllUserEventReminders(user.id);
        }
      }

      return c.json({
        success: true,
        data: {
          notifyDeadlineReminders:
            updates.notifyDeadlineReminders ??
            current.notifyDeadlineReminders,
          notifyEventReminders:
            updates.notifyEventReminders ?? current.notifyEventReminders,
        },
      });
    },
  );

export default app;
```

- [ ] **Step 2: Mount the route in `index.ts`**

In `apps/server/src/index.ts`, add the import alongside the existing route imports:

```ts
import settingsRoute from "@/routes/settings";
```

Add the route to the `routes` chain, after the profile route:

```ts
  .route("/api/settings", settingsRoute);
```

The final `routes` chain should end with:
```ts
  .route("/api/deadlines", deadlinesRoute)
  .route("/api/profile", profile)
  .route("/api/settings", settingsRoute);
```

- [ ] **Step 3: Verify server type-check**

```bash
cd apps/server && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/server/src/routes/settings.ts apps/server/src/index.ts
git commit -m "feat: add settings route with GET and PATCH endpoints"
```

---

### Task 6: Gate reminder scheduling on user preferences

**Files:**
- Modify: `apps/server/src/routes/deadlines.ts`
- Modify: `apps/server/src/routes/events.ts`

- [ ] **Step 1: Update `deadlines.ts` imports**

In `apps/server/src/routes/deadlines.ts`, add `userSettings` to the schema import:

Replace:
```ts
import { deadlines, profiles } from "@my-better-t-app/db/schema";
```

With:
```ts
import { deadlines, profiles, userSettings } from "@my-better-t-app/db/schema";
```

- [ ] **Step 2: Gate scheduling in POST create handler**

In the POST `/` handler in `deadlines.ts`, add a settings check before scheduling. Replace:

```ts
      const email = await getUserEmail(user.id);
      const operationId = crypto.randomUUID();
      const reminders: ReminderIds = email
        ? await scheduleBothReminders(email, title, dueDate, operationId)
        : { reminder24hEmailId: null, reminder1hEmailId: null };
```

With:

```ts
      const email = await getUserEmail(user.id);

      const [settingsRow] = await db
        .select({ notify: userSettings.notifyDeadlineReminders })
        .from(userSettings)
        .where(eq(userSettings.id, user.id))
        .limit(1);
      const notifyEnabled = settingsRow?.notify ?? true;

      const operationId = crypto.randomUUID();
      const reminders: ReminderIds = email && notifyEnabled
        ? await scheduleBothReminders(email, title, dueDate, operationId)
        : { reminder24hEmailId: null, reminder1hEmailId: null };
```

- [ ] **Step 3: Gate scheduling in PATCH update handler**

In the PATCH `/:id` handler in `deadlines.ts`, add a settings check before rescheduling. Inside the `if (titleChanged || dueAtChanged)` block, replace:

```ts
        const email = await getUserEmail(user.id);
        if (email) {
          const operationId = crypto.randomUUID();
          reminders = await scheduleBothReminders(
            email,
            newTitle,
            newDueAt,
            operationId,
          );
        }
```

With:

```ts
        const email = await getUserEmail(user.id);
        const [settingsRow] = await db
          .select({ notify: userSettings.notifyDeadlineReminders })
          .from(userSettings)
          .where(eq(userSettings.id, user.id))
          .limit(1);
        const notifyEnabled = settingsRow?.notify ?? true;

        if (email && notifyEnabled) {
          const operationId = crypto.randomUUID();
          reminders = await scheduleBothReminders(
            email,
            newTitle,
            newDueAt,
            operationId,
          );
        }
```

- [ ] **Step 4: Update `events.ts` imports**

In `apps/server/src/routes/events.ts`, add `userSettings` to the schema import:

Replace:
```ts
import { events, eventRegistrations, profiles } from "@my-better-t-app/db/schema";
```

With:
```ts
import { events, eventRegistrations, profiles, userSettings } from "@my-better-t-app/db/schema";
```

- [ ] **Step 5: Gate scheduling in POST register handler**

In the POST `/:id/register` handler in `events.ts`, add a settings check. Replace:

```ts
    const operationId = crypto.randomUUID();
    const reminders = studentProfile?.email
      ? await scheduleBothEventReminders(
          studentProfile.email,
          event.title,
          event.eventDate,
          event.location,
          operationId,
        )
      : { reminder24hEmailId: null, reminder1hEmailId: null };
```

With:

```ts
    const [settingsRow] = await db
      .select({ notify: userSettings.notifyEventReminders })
      .from(userSettings)
      .where(eq(userSettings.id, user.id))
      .limit(1);
    const notifyEnabled = settingsRow?.notify ?? true;

    const operationId = crypto.randomUUID();
    const reminders = studentProfile?.email && notifyEnabled
      ? await scheduleBothEventReminders(
          studentProfile.email,
          event.title,
          event.eventDate,
          event.location,
          operationId,
        )
      : { reminder24hEmailId: null, reminder1hEmailId: null };
```

- [ ] **Step 6: Verify server type-check**

```bash
cd apps/server && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add apps/server/src/routes/deadlines.ts apps/server/src/routes/events.ts
git commit -m "feat: gate reminder scheduling on user notification preferences"
```

---

### Task 7: Install shadcn Switch and add Settings to sidebar

**Files:**
- Create: `apps/web/src/components/ui/switch.tsx` (via CLI)
- Modify: `apps/web/src/components/student-sidebar.tsx`

- [ ] **Step 1: Install shadcn Switch**

```bash
cd apps/web && echo "n" | npx shadcn@latest add switch
```

Expected: `apps/web/src/components/ui/switch.tsx` created.

- [ ] **Step 2: Add Settings nav item to sidebar**

In `apps/web/src/components/student-sidebar.tsx`, add `Settings` to the lucide-react import:

Replace:
```ts
import {
  GraduationCap,
  Home,
  LogOut,
  MessageSquare,
  StickyNote,
  User,
} from "lucide-react";
```

With:
```ts
import {
  GraduationCap,
  Home,
  LogOut,
  MessageSquare,
  Settings,
  StickyNote,
  User,
} from "lucide-react";
```

Then add the Settings item to `navItems`:

Replace:
```ts
const navItems = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/discussions", label: "Discussions", icon: MessageSquare },
  { to: "/notes-deadlines", label: "Notes | Deadlines", icon: StickyNote },
  { to: "/profile", label: "Profile", icon: User },
] as const;
```

With:
```ts
const navItems = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/discussions", label: "Discussions", icon: MessageSquare },
  { to: "/notes-deadlines", label: "Notes | Deadlines", icon: StickyNote },
  { to: "/profile", label: "Profile", icon: User },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/ui/switch.tsx apps/web/src/components/student-sidebar.tsx
git commit -m "feat: install shadcn Switch, add Settings to sidebar"
```

---

### Task 8: Create the Settings page

**Files:**
- Create: `apps/web/src/routes/_student/settings.tsx`

- [ ] **Step 1: Create the settings page**

Create `apps/web/src/routes/_student/settings.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Settings } from "lucide-react";
import { toast } from "sonner";
import type { InferResponseType } from "hono/client";
import { hc } from "hono/client";

import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { getApiClient } from "@/lib/api";
import type { AppType } from "server";

type Client = ReturnType<typeof hc<AppType>>;
type SettingsEndpoint = Client["api"]["settings"]["$get"];
type SettingsResponse = Extract<
  InferResponseType<SettingsEndpoint>,
  { success: true }
>;
type UserSettings = SettingsResponse["data"];

export const Route = createFileRoute("/_student/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [savingField, setSavingField] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const api = await getApiClient();
      const res = await api.api.settings.$get();
      if (!res.ok) {
        toast.error("Failed to load settings");
        return;
      }
      const json = (await res.json()) as SettingsResponse;
      setSettings(json.data);
    } catch {
      toast.error("Failed to load settings");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  async function handleToggle(field: keyof UserSettings, value: boolean) {
    if (!settings || savingField) return;
    setSavingField(field);
    try {
      const api = await getApiClient();
      const res = await api.api.settings.$patch({
        json: { [field]: value },
      });
      if (!res.ok) {
        toast.error("Failed to update setting");
        return;
      }
      const json = (await res.json()) as SettingsResponse;
      setSettings(json.data);
      toast.success("Setting updated");
    } catch {
      toast.error("Failed to update setting");
    } finally {
      setSavingField(null);
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
        <Skeleton className="h-8 w-32" />
        <div className="rounded-xl bg-card p-6 shadow-sm ring-1 ring-border/50">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="mt-1 h-4 w-64" />
          <div className="mt-4 space-y-4">
            <Skeleton className="h-[72px] rounded-lg" />
            <Skeleton className="h-[72px] rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="flex flex-col items-center gap-3 py-20">
          <div className="flex size-14 items-center justify-center rounded-full bg-secondary">
            <Settings className="size-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            Failed to load settings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>

      <div className="rounded-xl bg-card p-6 shadow-sm ring-1 ring-border/50">
        <h2 className="text-sm font-semibold">Notifications</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Choose which email notifications you receive.
        </p>

        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between rounded-lg bg-background p-4">
            <div className="space-y-0.5">
              <Label
                htmlFor="notify-deadlines"
                className="text-sm font-medium"
              >
                Deadline reminders
              </Label>
              <p className="text-xs text-muted-foreground">
                Get email reminders 24 hours and 1 hour before your deadlines.
              </p>
            </div>
            <Switch
              id="notify-deadlines"
              checked={settings.notifyDeadlineReminders}
              onCheckedChange={(checked) =>
                handleToggle("notifyDeadlineReminders", checked)
              }
              disabled={savingField !== null}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg bg-background p-4">
            <div className="space-y-0.5">
              <Label htmlFor="notify-events" className="text-sm font-medium">
                Event reminders
              </Label>
              <p className="text-xs text-muted-foreground">
                Get email reminders 24 hours and 1 hour before events you
                registered for.
              </p>
            </div>
            <Switch
              id="notify-events"
              checked={settings.notifyEventReminders}
              onCheckedChange={(checked) =>
                handleToggle("notifyEventReminders", checked)
              }
              disabled={savingField !== null}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Regenerate route tree**

```bash
cd apps/web && npx tsr generate
```

Expected: `routeTree.gen.ts` updated to include the new `/_student/settings` route.

- [ ] **Step 3: Verify web type-check**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/routes/_student/settings.tsx apps/web/src/routeTree.gen.ts
git commit -m "feat: add settings page with notification preference toggles"
```

---

### Task 9: Final verification

- [ ] **Step 1: Full server type-check**

```bash
cd apps/server && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 2: Full web type-check**

```bash
cd apps/web && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Manual smoke test**

Start both dev servers and verify:

1. Navigate to `/settings` — page loads, both switches default to ON
2. Toggle "Deadline reminders" OFF — switch disables during save, success toast, switch stays OFF
3. Toggle it back ON — same behavior, switch stays ON
4. Toggle "Event reminders" OFF and ON — same behavior
5. Refresh page — settings persist (values match what was toggled)
6. Check sidebar — Settings item appears with gear icon, highlights when active
7. Create a new deadline with reminders OFF — verify no Resend emails are scheduled (check server logs)
8. Register for an event with reminders OFF — verify no Resend emails are scheduled
