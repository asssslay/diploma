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
  scheduleDeadlineReminderMock,
  runThrottledMock,
} = vi.hoisted(() => {
  const selectLimitMock = vi.fn();
  const selectWhereResolveMock = vi.fn();
  const selectWhereMock = vi.fn(() => ({
    limit: selectLimitMock,
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve(selectWhereResolveMock()).then(resolve),
  }));
  const selectFromMock = vi.fn(() => ({ where: selectWhereMock }));
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
    scheduleDeadlineReminderMock: vi.fn(),
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
  scheduleDeadlineReminder: scheduleDeadlineReminderMock,
}));

vi.mock("@/lib/throttle", () => ({
  runThrottled: runThrottledMock,
}));

const {
  cancelAllUserDeadlineReminders,
  scheduleAllUserDeadlineReminders,
} = await import("./deadline-reminders");

describe("deadline reminder helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateWhereMock.mockResolvedValue(undefined);
  });

  it("cancels all existing reminder ids and clears them in storage", async () => {
    selectWhereResolveMock.mockResolvedValueOnce([
      {
        id: "deadline-1",
        reminder24hEmailId: "24h-id",
        reminder1hEmailId: "1h-id",
      },
    ]);
    cancelScheduledEmailMock.mockResolvedValue(true);

    await cancelAllUserDeadlineReminders("user-1");

    expect(runThrottledMock).toHaveBeenCalledTimes(1);
    expect(cancelScheduledEmailMock).toHaveBeenCalledWith("24h-id");
    expect(cancelScheduledEmailMock).toHaveBeenCalledWith("1h-id");
    expect(updateSetMock).toHaveBeenCalledWith({
      reminder24hEmailId: null,
      reminder1hEmailId: null,
    });
  });

  it("returns early when the user has no email for rescheduling", async () => {
    selectLimitMock.mockResolvedValueOnce([]);

    await scheduleAllUserDeadlineReminders("user-1");

    expect(scheduleDeadlineReminderMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });
});
