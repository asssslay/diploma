import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  selectLimitMock,
  selectWhereMock,
  selectWhereResolveMock,
  selectFromMock,
  selectMock,
  updateWhereMock,
  updateSetMock,
  updateMock,
  cancelScheduledEmailMock,
  scheduleEventReminderMock,
  runThrottledMock,
} = vi.hoisted(() => {
  const selectLimitMock = vi.fn();
  const selectWhereResolveMock = vi.fn();
  const selectWhereMock = vi.fn(() => ({
    limit: selectLimitMock,
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve(selectWhereResolveMock()).then(resolve),
  }));
  const selectFromMock = vi.fn(() => ({
    where: selectWhereMock,
    innerJoin: () => ({ leftJoin: () => ({ where: selectWhereMock }) }),
  }));
  const selectMock = vi.fn(() => ({ from: selectFromMock }));

  const updateWhereMock = vi.fn();
  const updateSetMock = vi.fn(() => ({ where: updateWhereMock }));
  const updateMock = vi.fn(() => ({ set: updateSetMock }));

  return {
    selectLimitMock,
    selectWhereMock,
    selectWhereResolveMock,
    selectFromMock,
    selectMock,
    updateWhereMock,
    updateSetMock,
    updateMock,
    cancelScheduledEmailMock: vi.fn(),
    scheduleEventReminderMock: vi.fn(),
    runThrottledMock: vi.fn(async (tasks: Array<() => Promise<unknown>>) =>
      Promise.all(tasks.map((task) => task())),
    ),
  };
});

vi.mock("@my-better-t-app/db", () => ({
  db: {
    select: selectMock,
    update: updateMock,
  },
}));

vi.mock("@/lib/emails", () => ({
  cancelScheduledEmail: cancelScheduledEmailMock,
  scheduleEventReminder: scheduleEventReminderMock,
}));

vi.mock("@/lib/throttle", () => ({
  runThrottled: runThrottledMock,
}));

const {
  cancelAllEventReminders,
  cancelAllUserEventReminders,
  cancelBothEventReminders,
  scheduleAllUserEventReminders,
} = await import("./event-reminders");

describe("event reminder helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateWhereMock.mockResolvedValue(undefined);
  });

  it("cancels both reminder ids when present", async () => {
    cancelScheduledEmailMock.mockResolvedValue(true);

    await cancelBothEventReminders({
      reminder24hEmailId: "24h-id",
      reminder1hEmailId: "1h-id",
    });

    expect(cancelScheduledEmailMock).toHaveBeenCalledWith("24h-id");
    expect(cancelScheduledEmailMock).toHaveBeenCalledWith("1h-id");
  });

  it("returns zero when an event has no reminder ids to cancel", async () => {
    selectWhereResolveMock.mockResolvedValueOnce([
      { reminder24hEmailId: null, reminder1hEmailId: null },
    ]);

    await expect(cancelAllEventReminders("event-1")).resolves.toBe(0);
    expect(runThrottledMock).not.toHaveBeenCalled();
  });

  it("cancels all user reminders and clears stored ids", async () => {
    selectWhereResolveMock.mockResolvedValueOnce([
      {
        id: "registration-1",
        reminder24hEmailId: "24h-id",
        reminder1hEmailId: "1h-id",
      },
    ]);
    cancelScheduledEmailMock.mockResolvedValue(true);

    await cancelAllUserEventReminders("user-1");

    expect(runThrottledMock).toHaveBeenCalledTimes(1);
    expect(updateSetMock).toHaveBeenCalledWith({
      reminder24hEmailId: null,
      reminder1hEmailId: null,
    });
  });

  it("returns early when the user has no email for reminder scheduling", async () => {
    selectLimitMock.mockResolvedValueOnce([]);

    await scheduleAllUserEventReminders("user-1");

    expect(scheduleEventReminderMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });
});
