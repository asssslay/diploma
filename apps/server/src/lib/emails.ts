import { env } from "@my-better-t-app/env/server";
import { resend } from "@/lib/resend";

type EmailTemplate = {
  subject: string;
  html: string;
};

type ReminderTag = {
  name: string;
  value: string;
};

type ScheduleReminderOptions = {
  to: string;
  template: EmailTemplate;
  targetDate: Date;
  hoursBefore: number;
  tags: ReminderTag[];
  idempotencyKey: string;
  skipPastMessage: (scheduledAtIso: string) => string;
  skipBeyondWindowMessage: (scheduledAtIso: string) => string;
  failureMessage: (scheduledAtIso: string) => string;
  unexpectedErrorMessage: string;
  successMessage: (scheduledAtIso: string, emailId: string | null | undefined) => string;
};

// Resend can only schedule emails up to 30 days in advance.
const MAX_SCHEDULE_DAYS = 30;
const SCHEDULE_WINDOW_MS = MAX_SCHEDULE_DAYS * 24 * 60 * 60 * 1000;

export function accountApprovedEmail(fullName: string | null): EmailTemplate {
  const name = fullName?.trim() || "there";
  return {
    subject: "Your UniCommunity account has been approved",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #0a0a0a;">
        <h1 style="font-size: 22px; font-weight: 700; margin: 0 0 16px;">Welcome to UniCommunity</h1>
        <p style="font-size: 15px; line-height: 1.6; margin: 0 0 12px;">Hi ${escapeHtml(name)},</p>
        <p style="font-size: 15px; line-height: 1.6; margin: 0 0 12px;">
          Great news - your student account has been approved. You can now sign in and start
          exploring news, events, and discussions from across the university community.
        </p>
        <p style="font-size: 13px; line-height: 1.6; color: #737373; margin: 32px 0 0;">
          - The UniCommunity Team
        </p>
      </div>
    `,
  };
}

export function accountRejectedEmail(
  fullName: string | null,
  reason: string,
): EmailTemplate {
  const name = fullName?.trim() || "there";
  return {
    subject: "Update on your UniCommunity account application",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #0a0a0a;">
        <h1 style="font-size: 22px; font-weight: 700; margin: 0 0 16px;">Application update</h1>
        <p style="font-size: 15px; line-height: 1.6; margin: 0 0 12px;">Hi ${escapeHtml(name)},</p>
        <p style="font-size: 15px; line-height: 1.6; margin: 0 0 12px;">
          Thank you for your interest in UniCommunity. After reviewing your application,
          we are unable to approve your account at this time.
        </p>
        <div style="background: #f5f5f5; border-left: 3px solid #d4d4d4; padding: 12px 16px; margin: 20px 0; border-radius: 4px;">
          <p style="font-size: 13px; font-weight: 600; margin: 0 0 4px; color: #525252;">Reason</p>
          <p style="font-size: 14px; line-height: 1.5; margin: 0;">${escapeHtml(reason)}</p>
        </div>
        <p style="font-size: 15px; line-height: 1.6; margin: 0 0 12px;">
          If you believe this was a mistake or would like to provide additional information,
          please contact your university administrator.
        </p>
        <p style="font-size: 13px; line-height: 1.6; color: #737373; margin: 32px 0 0;">
          - The UniCommunity Team
        </p>
      </div>
    `,
  };
}

// Sends a rendered transactional email and logs provider failures without breaking the caller flow.
export async function sendEmail(
  to: string,
  template: EmailTemplate,
): Promise<void> {
  // Fire-and-log keeps approval/rejection flows resilient even if email delivery is temporarily degraded.
  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: [to],
    subject: template.subject,
    html: template.html,
  });

  if (error) {
    console.error("[email] Failed to send:", error);
  }
}

export function deadlineReminderEmail(
  title: string,
  dueAt: Date,
  hoursBefore: number,
): EmailTemplate {
  const formattedDate = dueAt.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const formattedTime = dueAt.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });

  const subject =
    hoursBefore >= 24
      ? `Reminder: ${title} is due tomorrow`
      : `Reminder: ${title} is due in ${hoursBefore} hour${hoursBefore === 1 ? "" : "s"}`;

  const leadText =
    hoursBefore >= 24
      ? "This is a friendly reminder that the following deadline is due in about 24 hours."
      : `Heads up - the following deadline is due in about ${hoursBefore} hour${hoursBefore === 1 ? "" : "s"}.`;

  return {
    subject,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #0a0a0a;">
        <h1 style="font-size: 22px; font-weight: 700; margin: 0 0 16px;">Deadline reminder</h1>
        <p style="font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
          ${leadText}
        </p>
        <div style="background: #f5f5f5; border-left: 3px solid #c6ff3d; padding: 16px 20px; margin: 20px 0; border-radius: 4px;">
          <p style="font-size: 17px; font-weight: 700; margin: 0 0 8px; color: #0a0a0a;">${escapeHtml(title)}</p>
          <p style="font-size: 14px; line-height: 1.5; margin: 0; color: #525252;">
            ${escapeHtml(formattedDate)} &middot; ${escapeHtml(formattedTime)}
          </p>
        </div>
        <p style="font-size: 13px; line-height: 1.6; color: #737373; margin: 32px 0 0;">
          - The UniCommunity Team
        </p>
      </div>
    `,
  };
}

// Queues a deadline reminder email when the send time is still valid for the provider window.
export async function scheduleDeadlineReminder(
  to: string,
  title: string,
  dueAt: Date,
  hoursBefore: number,
  operationId: string,
): Promise<string | null> {
  return scheduleReminderEmail({
    to,
    template: deadlineReminderEmail(title, dueAt, hoursBefore),
    targetDate: dueAt,
    hoursBefore,
    tags: [
      { name: "type", value: "deadline_reminder" },
      { name: "hours_before", value: String(hoursBefore) },
    ],
    // Idempotency lets reschedule/retry paths call this safely without duplicating queued emails.
    idempotencyKey: `deadline-reminder-${hoursBefore}h/${operationId}`,
    skipPastMessage: (scheduledAtIso) =>
      `[reminder] Skipping ${hoursBefore}h schedule for "${title}": scheduledAt ${scheduledAtIso} is in the past`,
    skipBeyondWindowMessage: (scheduledAtIso) =>
      `[reminder] Skipping ${hoursBefore}h schedule for "${title}": scheduledAt ${scheduledAtIso} is beyond 30-day window`,
    failureMessage: (scheduledAtIso) =>
      `[reminder] Failed to schedule ${hoursBefore}h "${title}" for ${scheduledAtIso}:`,
    unexpectedErrorMessage: `[reminder] Unexpected error scheduling ${hoursBefore}h "${title}":`,
    successMessage: (scheduledAtIso, emailId) =>
      `[reminder] Scheduled ${hoursBefore}h "${title}" -> id=${emailId} scheduledAt=${scheduledAtIso}`,
  });
}

export function eventReminderEmail(
  title: string,
  eventDate: Date,
  location: string,
  hoursBefore: number,
): EmailTemplate {
  const formattedDate = eventDate.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const formattedTime = eventDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });

  const subject =
    hoursBefore >= 24
      ? `Reminder: ${title} starts tomorrow`
      : `Reminder: ${title} starts in ${hoursBefore} hour${hoursBefore === 1 ? "" : "s"}`;

  const leadText =
    hoursBefore >= 24
      ? "This is a friendly reminder that the following event starts in about 24 hours."
      : `Heads up - the following event starts in about ${hoursBefore} hour${hoursBefore === 1 ? "" : "s"}.`;

  return {
    subject,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #0a0a0a;">
        <h1 style="font-size: 22px; font-weight: 700; margin: 0 0 16px;">Event reminder</h1>
        <p style="font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
          ${leadText}
        </p>
        <div style="background: #f5f5f5; border-left: 3px solid #c6ff3d; padding: 16px 20px; margin: 20px 0; border-radius: 4px;">
          <p style="font-size: 17px; font-weight: 700; margin: 0 0 8px; color: #0a0a0a;">${escapeHtml(title)}</p>
          <p style="font-size: 14px; line-height: 1.5; margin: 0 0 4px; color: #525252;">
            ${escapeHtml(formattedDate)} &middot; ${escapeHtml(formattedTime)}
          </p>
          <p style="font-size: 14px; line-height: 1.5; margin: 0; color: #525252;">
            ${escapeHtml(location)}
          </p>
        </div>
        <p style="font-size: 13px; line-height: 1.6; color: #737373; margin: 32px 0 0;">
          - The UniCommunity Team
        </p>
      </div>
    `,
  };
}

// Queues an event reminder email when the requested send time is still schedulable.
export async function scheduleEventReminder(
  to: string,
  title: string,
  eventDate: Date,
  location: string,
  hoursBefore: number,
  operationId: string,
): Promise<string | null> {
  return scheduleReminderEmail({
    to,
    template: eventReminderEmail(title, eventDate, location, hoursBefore),
    targetDate: eventDate,
    hoursBefore,
    tags: [
      { name: "type", value: "event_reminder" },
      { name: "hours_before", value: String(hoursBefore) },
    ],
    // The operation id scopes retries for one logical registration/update cycle.
    idempotencyKey: `event-reminder-${hoursBefore}h/${operationId}`,
    skipPastMessage: (scheduledAtIso) =>
      `[reminder] Skipping ${hoursBefore}h event schedule for "${title}": scheduledAt ${scheduledAtIso} is in the past`,
    skipBeyondWindowMessage: (scheduledAtIso) =>
      `[reminder] Skipping ${hoursBefore}h event schedule for "${title}": scheduledAt ${scheduledAtIso} is beyond 30-day window`,
    failureMessage: (scheduledAtIso) =>
      `[reminder] Failed to schedule ${hoursBefore}h event "${title}" for ${scheduledAtIso}:`,
    unexpectedErrorMessage: `[reminder] Unexpected error scheduling ${hoursBefore}h event "${title}":`,
    successMessage: (scheduledAtIso, emailId) =>
      `[reminder] Scheduled ${hoursBefore}h event "${title}" -> id=${emailId} scheduledAt=${scheduledAtIso}`,
  });
}

/**
 * Cancels a scheduled email. Returns true on success, false on failure.
 */
export async function cancelScheduledEmail(
  emailId: string,
): Promise<boolean> {
  console.log(`[reminder] Cancelling id=${emailId}...`);
  try {
    const { data, error } = await resend.emails.cancel(emailId);
    if (error) {
      console.error(
        `[reminder] Failed to cancel id=${emailId}:`,
        JSON.stringify(error),
      );
      return false;
    }
    console.log(`[reminder] Cancelled id=${emailId}`, data);
    return true;
  } catch (err) {
    console.error(`[reminder] Unexpected error cancelling id=${emailId}:`, err);
    return false;
  }
}

function calculateScheduledAt(targetDate: Date, hoursBefore: number): Date {
  return new Date(targetDate.getTime() - hoursBefore * 60 * 60 * 1000);
}

function isOutsideScheduleWindow(scheduledAt: Date): {
  inPast: boolean;
  beyondWindow: boolean;
} {
  const scheduledAtMs = scheduledAt.getTime();
  const now = Date.now();

  return {
    inPast: scheduledAtMs <= now,
    beyondWindow: scheduledAtMs > now + SCHEDULE_WINDOW_MS,
  };
}

async function scheduleReminderEmail({
  to,
  template,
  targetDate,
  hoursBefore,
  tags,
  idempotencyKey,
  skipPastMessage,
  skipBeyondWindowMessage,
  failureMessage,
  unexpectedErrorMessage,
  successMessage,
}: ScheduleReminderOptions): Promise<string | null> {
  const scheduledAt = calculateScheduledAt(targetDate, hoursBefore);
  const scheduledAtIso = scheduledAt.toISOString();
  const scheduleWindow = isOutsideScheduleWindow(scheduledAt);

  if (scheduleWindow.inPast) {
    console.log(skipPastMessage(scheduledAtIso));
    return null;
  }

  if (scheduleWindow.beyondWindow) {
    console.log(skipBeyondWindowMessage(scheduledAtIso));
    return null;
  }

  try {
    const { data, error } = await resend.emails.send(
      {
        from: env.EMAIL_FROM,
        to: [to],
        subject: template.subject,
        html: template.html,
        scheduledAt: scheduledAtIso,
        tags,
      },
      { idempotencyKey },
    );

    if (error) {
      console.error(failureMessage(scheduledAtIso), error);
      return null;
    }

    console.log(successMessage(scheduledAtIso, data?.id));
    return data?.id ?? null;
  } catch (err) {
    console.error(unexpectedErrorMessage, err);
    return null;
  }
}

// Escapes dynamic strings before they are interpolated into raw HTML templates.
function escapeHtml(value: string): string {
  // Templates interpolate user-authored strings directly into HTML, so escape on every dynamic field.
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
