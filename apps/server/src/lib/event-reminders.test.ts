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
  const joinedQuery = {
    where: selectWhereMock,
    leftJoin: () => ({ where: selectWhereMock }),
  };
  const selectFromMock = vi.fn(() => ({
    where: selectWhereMock,
    innerJoin: () => joinedQuery,
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
  rescheduleAllEventReminders,
  scheduleBothEventReminders,
  scheduleAllUserEventReminders,
} = await import("./event-reminders");

describe("event reminder helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateWhereMock.mockResolvedValue(undefined);
    vi.stubGlobal("crypto", {
      randomUUID: vi.fn(() => "operation-1"),
    });
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

  it("cancels every stored reminder id for an event", async () => {
    selectWhereResolveMock.mockResolvedValueOnce([
      { reminder24hEmailId: "24h-id", reminder1hEmailId: null },
      { reminder24hEmailId: null, reminder1hEmailId: "1h-id" },
    ]);
    cancelScheduledEmailMock.mockResolvedValue(true);

    await expect(cancelAllEventReminders("event-1")).resolves.toBe(2);

    expect(runThrottledMock).toHaveBeenCalledTimes(1);
    expect(cancelScheduledEmailMock).toHaveBeenCalledWith("24h-id");
    expect(cancelScheduledEmailMock).toHaveBeenCalledWith("1h-id");
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

  it("schedules both event reminder ids in parallel", async () => {
    scheduleEventReminderMock
      .mockResolvedValueOnce("24h-id")
      .mockResolvedValueOnce("1h-id");

    await expect(
      scheduleBothEventReminders(
        "user@example.com",
        "Hackathon",
        new Date("2030-06-01T12:00:00.000Z"),
        "Main Hall",
        "operation-1",
      ),
    ).resolves.toEqual({
      reminder24hEmailId: "24h-id",
      reminder1hEmailId: "1h-id",
    });
  });

  it("nulls reminder ids instead of rescheduling when notifications are disabled", async () => {
    // Reschedule always cancels stale ids first; this branch verifies we stop there when user preferences opt out.
    selectWhereResolveMock.mockResolvedValueOnce([
      {
        registrationId: "registration-1",
        studentId: "user-1",
        email: "user@example.com",
        reminder24hEmailId: "24h-id",
        reminder1hEmailId: "1h-id",
        notifyEventReminders: false,
      },
    ]);
    cancelScheduledEmailMock.mockResolvedValue(true);

    await rescheduleAllEventReminders(
      "event-1",
      "Updated title",
      new Date("2030-06-01T12:00:00.000Z"),
      "New Hall",
    );

    expect(cancelScheduledEmailMock).toHaveBeenCalledWith("24h-id");
    expect(cancelScheduledEmailMock).toHaveBeenCalledWith("1h-id");
    expect(scheduleEventReminderMock).not.toHaveBeenCalled();
    expect(updateSetMock).toHaveBeenCalledWith({
      reminder24hEmailId: null,
      reminder1hEmailId: null,
    });
  });

  it("skips rows without an email during reschedule and clears stored ids", async () => {
    selectWhereResolveMock.mockResolvedValueOnce([
      {
        registrationId: "registration-1",
        studentId: "user-1",
        email: null,
        reminder24hEmailId: null,
        reminder1hEmailId: "1h-id",
        notifyEventReminders: true,
      },
    ]);
    cancelScheduledEmailMock.mockResolvedValue(true);

    await rescheduleAllEventReminders(
      "event-1",
      "Updated title",
      new Date("2030-06-01T12:00:00.000Z"),
      "New Hall",
    );

    expect(scheduleEventReminderMock).not.toHaveBeenCalled();
    expect(updateSetMock).toHaveBeenCalledWith({
      reminder24hEmailId: null,
      reminder1hEmailId: null,
    });
  });

  it("reschedules and persists new reminder ids for each registration", async () => {
    selectWhereResolveMock.mockResolvedValueOnce([
      {
        registrationId: "registration-1",
        studentId: "user-1",
        email: "user@example.com",
        reminder24hEmailId: "old-24h",
        reminder1hEmailId: "old-1h",
        notifyEventReminders: true,
      },
    ]);
    cancelScheduledEmailMock.mockResolvedValue(true);
    scheduleEventReminderMock
      .mockResolvedValueOnce("new-24h")
      .mockResolvedValueOnce("new-1h");

    await rescheduleAllEventReminders(
      "event-1",
      "Updated title",
      new Date("2030-06-01T12:00:00.000Z"),
      "New Hall",
    );

    expect(scheduleEventReminderMock).toHaveBeenCalledTimes(2);
    expect(updateSetMock).toHaveBeenCalledWith({
      reminder24hEmailId: "new-24h",
      reminder1hEmailId: "new-1h",
    });
  });

  it("continues scheduling user event reminders when one registration fails", async () => {
    // The first registration throws on its 24h reminder, but the second registration should still complete fully.
    selectLimitMock.mockResolvedValueOnce([{ email: "user@example.com" }]);
    selectWhereResolveMock.mockResolvedValueOnce([
      {
        registrationId: "registration-1",
        title: "Hackathon",
        eventDate: new Date("2030-06-01T12:00:00.000Z"),
        location: "Hall A",
      },
      {
        registrationId: "registration-2",
        title: "Workshop",
        eventDate: new Date("2030-06-02T12:00:00.000Z"),
        location: "Hall B",
      },
    ]);
    scheduleEventReminderMock
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce("one")
      .mockResolvedValueOnce("two")
      .mockResolvedValueOnce("three");

    await scheduleAllUserEventReminders("user-1");

    expect(runThrottledMock).toHaveBeenCalledTimes(1);
    expect(scheduleEventReminderMock).toHaveBeenCalledTimes(4);
    expect(updateSetMock).toHaveBeenCalledWith({
      reminder24hEmailId: "two",
      reminder1hEmailId: "three",
    });
  });
});
