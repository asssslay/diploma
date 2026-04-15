import { env } from "@my-better-t-app/env/server";
import { resend } from "@/lib/resend";

type EmailTemplate = {
  subject: string;
  html: string;
};

// Resend can only schedule emails up to 30 days in advance.
const MAX_SCHEDULE_DAYS = 30;

export function accountApprovedEmail(fullName: string | null): EmailTemplate {
  const name = fullName?.trim() || "there";
  return {
    subject: "Your UniCommunity account has been approved",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #0a0a0a;">
        <h1 style="font-size: 22px; font-weight: 700; margin: 0 0 16px;">Welcome to UniCommunity</h1>
        <p style="font-size: 15px; line-height: 1.6; margin: 0 0 12px;">Hi ${escapeHtml(name)},</p>
        <p style="font-size: 15px; line-height: 1.6; margin: 0 0 12px;">
          Great news — your student account has been approved. You can now sign in and start
          exploring news, events, and discussions from across the university community.
        </p>
        <p style="font-size: 13px; line-height: 1.6; color: #737373; margin: 32px 0 0;">
          — The UniCommunity Team
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
          — The UniCommunity Team
        </p>
      </div>
    `,
  };
}

export async function sendEmail(
  to: string,
  template: EmailTemplate,
): Promise<void> {
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
      : `Heads up — the following deadline is due in about ${hoursBefore} hour${hoursBefore === 1 ? "" : "s"}.`;

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
          — The UniCommunity Team
        </p>
      </div>
    `,
  };
}

export async function scheduleDeadlineReminder(
  to: string,
  title: string,
  dueAt: Date,
  hoursBefore: number,
  operationId: string,
): Promise<string | null> {
  const scheduledAt = new Date(dueAt.getTime() - hoursBefore * 60 * 60 * 1000);
  const now = Date.now();

  if (scheduledAt.getTime() <= now) {
    console.log(
      `[reminder] Skipping ${hoursBefore}h schedule for "${title}": scheduledAt ${scheduledAt.toISOString()} is in the past`,
    );
    return null;
  }
  if (scheduledAt.getTime() > now + MAX_SCHEDULE_DAYS * 24 * 60 * 60 * 1000) {
    console.log(
      `[reminder] Skipping ${hoursBefore}h schedule for "${title}": scheduledAt ${scheduledAt.toISOString()} is beyond 30-day window`,
    );
    return null;
  }

  const template = deadlineReminderEmail(title, dueAt, hoursBefore);

  try {
    const { data, error } = await resend.emails.send(
      {
        from: env.EMAIL_FROM,
        to: [to],
        subject: template.subject,
        html: template.html,
        scheduledAt: scheduledAt.toISOString(),
        tags: [
          { name: "type", value: "deadline_reminder" },
          { name: "hours_before", value: String(hoursBefore) },
        ],
      },
      {
        idempotencyKey: `deadline-reminder-${hoursBefore}h/${operationId}`,
      },
    );

    if (error) {
      console.error(
        `[reminder] Failed to schedule ${hoursBefore}h "${title}" for ${scheduledAt.toISOString()}:`,
        error,
      );
      return null;
    }
    console.log(
      `[reminder] Scheduled ${hoursBefore}h "${title}" → id=${data?.id} scheduledAt=${scheduledAt.toISOString()}`,
    );
    return data?.id ?? null;
  } catch (err) {
    console.error(
      `[reminder] Unexpected error scheduling ${hoursBefore}h "${title}":`,
      err,
    );
    return null;
  }
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
      : `Heads up — the following event starts in about ${hoursBefore} hour${hoursBefore === 1 ? "" : "s"}.`;

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
          — The UniCommunity Team
        </p>
      </div>
    `,
  };
}

export async function scheduleEventReminder(
  to: string,
  title: string,
  eventDate: Date,
  location: string,
  hoursBefore: number,
  operationId: string,
): Promise<string | null> {
  const scheduledAt = new Date(eventDate.getTime() - hoursBefore * 60 * 60 * 1000);
  const now = Date.now();

  if (scheduledAt.getTime() <= now) {
    console.log(
      `[reminder] Skipping ${hoursBefore}h event schedule for "${title}": scheduledAt ${scheduledAt.toISOString()} is in the past`,
    );
    return null;
  }
  if (scheduledAt.getTime() > now + MAX_SCHEDULE_DAYS * 24 * 60 * 60 * 1000) {
    console.log(
      `[reminder] Skipping ${hoursBefore}h event schedule for "${title}": scheduledAt ${scheduledAt.toISOString()} is beyond 30-day window`,
    );
    return null;
  }

  const template = eventReminderEmail(title, eventDate, location, hoursBefore);

  try {
    const { data, error } = await resend.emails.send(
      {
        from: env.EMAIL_FROM,
        to: [to],
        subject: template.subject,
        html: template.html,
        scheduledAt: scheduledAt.toISOString(),
        tags: [
          { name: "type", value: "event_reminder" },
          { name: "hours_before", value: String(hoursBefore) },
        ],
      },
      {
        idempotencyKey: `event-reminder-${hoursBefore}h/${operationId}`,
      },
    );

    if (error) {
      console.error(
        `[reminder] Failed to schedule ${hoursBefore}h event "${title}" for ${scheduledAt.toISOString()}:`,
        error,
      );
      return null;
    }
    console.log(
      `[reminder] Scheduled ${hoursBefore}h event "${title}" → id=${data?.id} scheduledAt=${scheduledAt.toISOString()}`,
    );
    return data?.id ?? null;
  } catch (err) {
    console.error(
      `[reminder] Unexpected error scheduling ${hoursBefore}h event "${title}":`,
      err,
    );
    return null;
  }
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
