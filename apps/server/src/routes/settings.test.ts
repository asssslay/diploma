import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  insertOnConflictDoNothingMock,
  insertValuesMock,
  insertMock,
  selectLimitMock,
  selectWhereMock,
  selectFromMock,
  selectMock,
  updateWhereMock,
  updateSetMock,
  updateMock,
  cancelAllUserDeadlineRemindersMock,
  scheduleAllUserDeadlineRemindersMock,
  cancelAllUserEventRemindersMock,
  scheduleAllUserEventRemindersMock,
} = vi.hoisted(() => {
  const insertOnConflictDoNothingMock = vi.fn();
  const insertValuesMock = vi.fn(() => ({
    onConflictDoNothing: insertOnConflictDoNothingMock,
  }));
  const insertMock = vi.fn(() => ({ values: insertValuesMock }));

  const selectLimitMock = vi.fn();
  const selectWhereMock = vi.fn(() => ({ limit: selectLimitMock }));
  const selectFromMock = vi.fn(() => ({ where: selectWhereMock }));
  const selectMock = vi.fn(() => ({ from: selectFromMock }));

  const updateWhereMock = vi.fn();
  const updateSetMock = vi.fn(() => ({ where: updateWhereMock }));
  const updateMock = vi.fn(() => ({ set: updateSetMock }));

  return {
    insertOnConflictDoNothingMock,
    insertValuesMock,
    insertMock,
    selectLimitMock,
    selectWhereMock,
    selectFromMock,
    selectMock,
    updateWhereMock,
    updateSetMock,
    updateMock,
    cancelAllUserDeadlineRemindersMock: vi.fn(),
    scheduleAllUserDeadlineRemindersMock: vi.fn(),
    cancelAllUserEventRemindersMock: vi.fn(),
    scheduleAllUserEventRemindersMock: vi.fn(),
  };
});

vi.mock("@my-better-t-app/db", () => ({
  db: {
    insert: insertMock,
    select: selectMock,
    update: updateMock,
  },
}));

vi.mock("@/middleware/auth", async () => {
  const { createAppMiddleware } = await import("@/lib/app");
  return {
    auth: createAppMiddleware(async (c, next) => {
      c.set("user", { id: "user-1", email: "user@example.com" });
      await next();
    }),
  };
});

vi.mock("@/lib/deadline-reminders", () => ({
  cancelAllUserDeadlineReminders: cancelAllUserDeadlineRemindersMock,
  scheduleAllUserDeadlineReminders: scheduleAllUserDeadlineRemindersMock,
}));

vi.mock("@/lib/event-reminders", () => ({
  cancelAllUserEventReminders: cancelAllUserEventRemindersMock,
  scheduleAllUserEventReminders: scheduleAllUserEventRemindersMock,
}));

import app from "./settings";

describe("settings routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertOnConflictDoNothingMock.mockResolvedValue(undefined);
    updateWhereMock.mockResolvedValue(undefined);
  });

  it("creates default settings on GET when none exist yet", async () => {
    selectLimitMock.mockResolvedValueOnce([
      {
        notifyDeadlineReminders: true,
        notifyEventReminders: true,
      },
    ]);

    const response = await app.request("http://localhost/", {
      method: "GET",
    });

    expect(response.status).toBe(200);
    expect(insertMock).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        notifyDeadlineReminders: true,
        notifyEventReminders: true,
      },
    });
  });

  it("does not trigger reminder work when patch values are unchanged", async () => {
    selectLimitMock.mockResolvedValueOnce([
      {
        notifyDeadlineReminders: true,
        notifyEventReminders: false,
      },
    ]);
    updateWhereMock.mockResolvedValue(undefined);

    const response = await app.request("http://localhost/", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        notifyDeadlineReminders: true,
        notifyEventReminders: false,
      }),
    });

    expect(response.status).toBe(200);
    expect(cancelAllUserDeadlineRemindersMock).not.toHaveBeenCalled();
    expect(scheduleAllUserDeadlineRemindersMock).not.toHaveBeenCalled();
    expect(cancelAllUserEventRemindersMock).not.toHaveBeenCalled();
    expect(scheduleAllUserEventRemindersMock).not.toHaveBeenCalled();
  });

  it("triggers the correct schedule and cancel branches for setting transitions", async () => {
    selectLimitMock.mockResolvedValueOnce([
      {
        notifyDeadlineReminders: false,
        notifyEventReminders: true,
      },
    ]);

    const response = await app.request("http://localhost/", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        notifyDeadlineReminders: true,
        notifyEventReminders: false,
      }),
    });

    expect(response.status).toBe(200);
    expect(scheduleAllUserDeadlineRemindersMock).toHaveBeenCalledWith("user-1");
    expect(cancelAllUserEventRemindersMock).toHaveBeenCalledWith("user-1");
    expect(cancelAllUserDeadlineRemindersMock).not.toHaveBeenCalled();
    expect(scheduleAllUserEventRemindersMock).not.toHaveBeenCalled();
  });
});
