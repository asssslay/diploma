# Settings Page — Design Spec

## Overview

Add a dedicated `/settings` page where students can view and update account settings. The first section implements email notification preferences — two toggles controlling whether the system sends deadline and event reminder emails.

## Decisions

- **Separate page** at `/_student/settings` with its own sidebar nav item (Settings, gear icon)
- **Disable = cancel existing + prevent future** — toggling off cancels all currently scheduled Resend emails for that category and prevents new ones
- **Re-enable = retroactive scheduling** — toggling on schedules reminders for all upcoming deadlines/registered events within the Resend 30-day window
- **Expandable sectioned layout** — "Notifications" is the first section, structured so future sections (Appearance, Privacy, etc.) can be added without rework
- **Approach B: dedicated route + domain helpers** — settings route stays thin, bulk cancel/schedule logic lives in domain-specific files

## Data Model

### `userSettings` table

Extends the existing placeholder (currently just `id` PK).

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | FK → profiles.id, onDelete cascade |
| notifyDeadlineReminders | boolean | notNull, default `true` |
| notifyEventReminders | boolean | notNull, default `true` |

### RLS policies

Following the owner-only pattern used by `notes` and `deadlines`:

- `owner_read_own_settings` — SELECT where `id = auth.uid()`
- `owner_insert_own_settings` — INSERT where `id = auth.uid()`
- `owner_update_own_settings` — UPDATE where `id = auth.uid()`

No DELETE policy — row lives as long as the profile (cascade handles cleanup).

### Lazy creation

No row exists until the student first visits `/settings`. The GET endpoint creates a row with defaults via `INSERT ... ON CONFLICT DO NOTHING` followed by SELECT. Avoids needing a trigger or migration backfill for existing users.

## Server — Settings Route

**New file:** `routes/settings.ts`

Mounted at `/api/settings` in `index.ts`. Both endpoints behind `auth` middleware.

### `GET /`

1. `INSERT INTO user_settings (id, notify_deadline_reminders, notify_event_reminders) VALUES (user.id, true, true) ON CONFLICT DO NOTHING`
2. `SELECT * FROM user_settings WHERE id = user.id`
3. Return `{ notifyDeadlineReminders, notifyEventReminders }`

### `PATCH /`

Validation schema:
```
z.object({
  notifyDeadlineReminders: z.boolean().optional(),
  notifyEventReminders: z.boolean().optional(),
})
```

Flow:
1. Read current settings (lazy-create if needed)
2. Apply updates to DB
3. Detect transitions:
   - deadlines true→false → `cancelAllUserDeadlineReminders(userId)`
   - deadlines false→true → `scheduleAllUserDeadlineReminders(userId)`
   - events true→false → `cancelAllUserEventReminders(userId)`
   - events false→true → `scheduleAllUserEventReminders(userId)`
4. Await bulk operations (not fire-and-forget) — the student's items are bounded (typically 10-20 Resend calls, ~5s), and the user needs an honest success/failure signal. If any Resend call fails, per-row try/catch in the helpers prevents it from blocking others; partial failures are logged but the PATCH still succeeds (DB state is already correct, individual reminder IDs are nulled on failure).
5. Return updated settings

## Server — Domain Helpers

### Shared utility: `lib/throttle.ts`

Extract `runThrottled` from `event-reminders.ts` into its own file. Both `event-reminders.ts` and the new `deadline-reminders.ts` import from here. Removes current duplication.

### New file: `lib/deadline-reminders.ts`

- **`cancelAllUserDeadlineReminders(userId)`** — Selects all deadlines for the user with non-null reminder IDs, cancels via Resend (throttled), nulls out the IDs in DB.
- **`scheduleAllUserDeadlineReminders(userId)`** — Selects all deadlines where `dueAt` is in the future, fetches user email, schedules both reminders (24h + 1h) per deadline (throttled), stores new Resend IDs.

### Extended file: `lib/event-reminders.ts`

Add user-scoped helpers alongside existing event-scoped ones:

- **`cancelAllUserEventReminders(userId)`** — Selects all event registrations for the user with non-null reminder IDs, cancels via Resend (throttled), nulls out IDs.
- **`scheduleAllUserEventReminders(userId)`** — Selects all event registrations for the user, joins events for title/date/location, filters to future events, schedules both reminders per registration (throttled), stores new IDs.

Update existing `rescheduleAllEventReminders(eventId, ...)` (used by admin event PATCH) to join `userSettings` and skip registrations where `notifyEventReminders = false`. This ensures admin edits respect individual student preferences.

### Gating existing scheduling

In `routes/deadlines.ts` (POST create, PATCH update) and `routes/events.ts` (POST register): before scheduling reminders, check user settings:

```
const settings = await db.select().from(userSettings).where(eq(userSettings.id, user.id)).limit(1)
const enabled = settings[0]?.notifyDeadlineReminders ?? true  // default true if no row
```

If disabled, skip scheduling (store null IDs).

## Frontend — Settings Page & Sidebar

### Sidebar: `student-sidebar.tsx`

Add nav item: `{ to: "/settings", label: "Settings", icon: Settings }` (lucide-react).

### New file: `routes/_student/settings.tsx`

**Layout:** Page heading "Settings", then sectioned cards. First section: "Notifications" card with two toggle rows.

**Each toggle row:**
- Left: label + description (e.g., "Deadline reminders" / "Get email reminders 24 hours and 1 hour before your deadlines")
- Right: shadcn `Switch`
- Switch disabled during save, re-enabled on response

**Data flow:**
1. On mount, `GET /api/settings` → populate switches
2. On toggle, disable the switch, fire `PATCH /api/settings` with changed field
3. On success, update local state to the new value, re-enable switch
4. On failure, keep original state, re-enable switch, show error toast

**Loading state:** Skeleton rows matching toggle layout.

**Components:** `createFileRoute("/_student/settings")`, shadcn Switch (install via `echo "n" | npx shadcn@latest add switch`), Card.

## Edge Cases

- **No settings row** — lazy-create on first GET/PATCH, defaults both to `true`
- **Both toggles changed at once** — PATCH handles each transition independently
- **Rapid toggling** — switch is disabled during PATCH, preventing double-submit
- **Many items to cancel/schedule** — throttled at 4 rps (Resend 5 rps limit), awaited so the user sees an honest result
- **Resend 30-day window** — existing guards in schedule helpers skip items beyond window
- **Concurrent admin event edit + user toggle** — admin reschedule is fire-and-forget, settings PATCH is awaited; last write wins IDs (acceptable)

## Out of Scope

- No admin visibility into user notification preferences
- No per-item granularity (all-or-nothing per category)
- No in-app notifications — strictly email reminders

## Files Changed

| File | Action |
|------|--------|
| `packages/db/src/schema.ts` | Modify — extend `userSettings` with columns + FK + RLS |
| `apps/server/src/lib/throttle.ts` | Create — extract `runThrottled` |
| `apps/server/src/lib/deadline-reminders.ts` | Create — user-scoped bulk helpers |
| `apps/server/src/lib/event-reminders.ts` | Modify — add user-scoped helpers, import from throttle.ts |
| `apps/server/src/routes/settings.ts` | Create — GET + PATCH endpoints |
| `apps/server/src/index.ts` | Modify — mount `/api/settings` |
| `apps/server/src/routes/deadlines.ts` | Modify — gate scheduling on user settings |
| `apps/server/src/routes/events.ts` | Modify — gate scheduling on user settings |
| `apps/web/src/components/student-sidebar.tsx` | Modify — add Settings nav item |
| `apps/web/src/routes/_student/settings.tsx` | Create — settings page with notification toggles |
| `apps/web/src/components/ui/switch.tsx` | Create — install shadcn Switch |
