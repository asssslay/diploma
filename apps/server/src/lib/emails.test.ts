import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { sendMock, cancelMock } = vi.hoisted(() => ({
  sendMock: vi.fn(),
  cancelMock: vi.fn(),
}));

vi.mock("@my-better-t-app/env/server", () => ({
  env: {
    EMAIL_FROM: "noreply@example.com",
  },
}));

vi.mock("@/lib/resend", () => ({
  resend: {
    emails: {
      send: sendMock,
      cancel: cancelMock,
    },
  },
}));

import {
  cancelScheduledEmail,
  scheduleDeadlineReminder,
  scheduleEventReminder,
  sendEmail,
} from "./emails";

describe("emails helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-26T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("skips deadline reminders scheduled in the past", async () => {
    const result = await scheduleDeadlineReminder(
      "user@example.com",
      "Past deadline",
      new Date("2026-04-26T12:30:00.000Z"),
      1,
      "op-1",
    );

    expect(result).toBeNull();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("skips event reminders beyond the 30-day scheduling window", async () => {
    const result = await scheduleEventReminder(
      "user@example.com",
      "Far future event",
      new Date("2026-06-30T12:00:00.000Z"),
      "Main Hall",
      24,
      "op-2",
    );

    expect(result).toBeNull();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("schedules valid reminders with tags and idempotency keys", async () => {
    sendMock.mockResolvedValue({
      data: { id: "email-123" },
      error: null,
    });

    const result = await scheduleDeadlineReminder(
      "user@example.com",
      "Algorithms assignment",
      new Date("2026-04-28T12:00:00.000Z"),
      24,
      "op-3",
    );

    expect(result).toBe("email-123");
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "noreply@example.com",
        to: ["user@example.com"],
        scheduledAt: "2026-04-27T12:00:00.000Z",
        tags: [
          { name: "type", value: "deadline_reminder" },
          { name: "hours_before", value: "24" },
        ],
      }),
      {
        idempotencyKey: "deadline-reminder-24h/op-3",
      },
    );
  });

  it("does not throw when sending a regular email fails", async () => {
    sendMock.mockResolvedValue({
      data: null,
      error: { message: "failed" },
    });

    await expect(
      sendEmail("user@example.com", { subject: "Hello", html: "<p>World</p>" }),
    ).resolves.toBeUndefined();
  });

  it("returns false when cancellation fails", async () => {
    cancelMock.mockResolvedValue({
      data: null,
      error: { message: "nope" },
    });

    await expect(cancelScheduledEmail("email-999")).resolves.toBe(false);
  });
});
