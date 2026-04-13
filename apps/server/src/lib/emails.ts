import { env } from "@my-better-t-app/env/server";
import { resend } from "@/lib/resend";

type EmailTemplate = {
  subject: string;
  html: string;
};

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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
