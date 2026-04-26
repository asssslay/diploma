import { beforeEach, describe, expect, it, vi } from "vitest";
import { HTTPException } from "hono/http-exception";

const {
  transactionMock,
  txSelectLimitMock,
  txSelectWhereMock,
  txWhereResolveMock,
  txSelectFromMock,
  txSelectMock,
  txInsertValuesMock,
  txInsertMock,
  selectLimitMock,
  selectWhereMock,
  selectFromMock,
  selectMock,
  updateReturningMock,
  updateWhereMock,
  updateSetMock,
  updateMock,
  scheduleBothEventRemindersMock,
} = vi.hoisted(() => {
  const txSelectLimitMock = vi.fn();
  const txSelectForMock = vi.fn(() => ({ limit: txSelectLimitMock }));
  const txWhereResolveMock = vi.fn();
  const txSelectWhereMock = vi.fn(() => ({
    limit: txSelectLimitMock,
    for: txSelectForMock,
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve(txWhereResolveMock()).then(resolve),
  }));
  const txSelectFromMock = vi.fn(() => ({
    where: txSelectWhereMock,
    limit: txSelectLimitMock,
    for: txSelectForMock,
  }));
  const txSelectMock = vi.fn(() => ({ from: txSelectFromMock }));
  const txInsertValuesMock = vi.fn();
  const txInsertMock = vi.fn(() => ({ values: txInsertValuesMock }));

  const selectLimitMock = vi.fn();
  const selectWhereMock = vi.fn(() => ({ limit: selectLimitMock }));
  const selectFromMock = vi.fn(() => ({ where: selectWhereMock }));
  const selectMock = vi.fn(() => ({ from: selectFromMock }));

  const updateReturningMock = vi.fn();
  const updateWhereMock = vi.fn(() => ({ returning: updateReturningMock }));
  const updateSetMock = vi.fn(() => ({ where: updateWhereMock }));
  const updateMock = vi.fn(() => ({ set: updateSetMock }));

  return {
    transactionMock: vi.fn(),
    txSelectLimitMock,
    txSelectWhereMock,
    txWhereResolveMock,
    txSelectFromMock,
    txSelectMock,
    txInsertValuesMock,
    txInsertMock,
    selectLimitMock,
    selectWhereMock,
    selectFromMock,
    selectMock,
    updateReturningMock,
    updateWhereMock,
    updateSetMock,
    updateMock,
    scheduleBothEventRemindersMock: vi.fn(),
  };
});

vi.mock("@my-better-t-app/db", () => ({
  db: {
    transaction: transactionMock,
    select: selectMock,
    update: updateMock,
  },
}));

vi.mock("@/lib/event-reminders", () => ({
  scheduleBothEventReminders: scheduleBothEventRemindersMock,
}));

const { registerForEvent, syncEventRegistrationReminders } = await import(
  "@/lib/event-registration"
);

describe("event registration helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transactionMock.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        select: txSelectMock,
        insert: txInsertMock,
      }),
    );
    txInsertValuesMock.mockResolvedValue(undefined);
  });

  it("throws 404 when the event does not exist", async () => {
    txSelectLimitMock.mockResolvedValueOnce([]);

    await expect(registerForEvent("event-1", "student-1")).rejects.toMatchObject<
      Partial<HTTPException>
    >({
      status: 404,
    });
  });

  it("throws 409 when the student is already registered", async () => {
    txSelectLimitMock
      .mockResolvedValueOnce([
        {
          id: "event-1",
          title: "Hackathon",
          eventDate: new Date("2026-05-01T12:00:00.000Z"),
          location: "Hall A",
          maxParticipants: 10,
        },
      ])
      .mockResolvedValueOnce([{ id: "registration-1" }]);

    await expect(registerForEvent("event-1", "student-1")).rejects.toMatchObject<
      Partial<HTTPException>
    >({
      status: 409,
    });
  });

  it("translates unique violations into conflict errors", async () => {
    txSelectLimitMock
      .mockResolvedValueOnce([
        {
          id: "event-1",
          title: "Hackathon",
          eventDate: new Date("2026-05-01T12:00:00.000Z"),
          location: "Hall A",
          maxParticipants: 10,
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ value: 0 }]);
    txInsertValuesMock.mockRejectedValueOnce({ code: "23505" });
    txWhereResolveMock.mockResolvedValueOnce([{ value: 0 }]);

    await expect(registerForEvent("event-1", "student-1")).rejects.toMatchObject<
      Partial<HTTPException>
    >({
      status: 409,
    });
  });

  it("skips reminder sync when email is missing or notifications are disabled", async () => {
    selectLimitMock
      .mockResolvedValueOnce([{ email: null }])
      .mockResolvedValueOnce([{ notify: true }]);

    await syncEventRegistrationReminders({
      eventId: "event-1",
      studentId: "student-1",
      title: "Hackathon",
      eventDate: new Date("2026-05-01T12:00:00.000Z"),
      location: "Hall A",
    });

    expect(scheduleBothEventRemindersMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("persists reminder ids when scheduling succeeds", async () => {
    selectLimitMock
      .mockResolvedValueOnce([{ email: "student@example.com" }])
      .mockResolvedValueOnce([{ notify: true }]);
    scheduleBothEventRemindersMock.mockResolvedValueOnce({
      reminder24hEmailId: "24h-id",
      reminder1hEmailId: "1h-id",
    });
    updateReturningMock.mockResolvedValueOnce([{ id: "registration-1" }]);

    await syncEventRegistrationReminders({
      eventId: "event-1",
      studentId: "student-1",
      title: "Hackathon",
      eventDate: new Date("2026-05-01T12:00:00.000Z"),
      location: "Hall A",
    });

    expect(scheduleBothEventRemindersMock).toHaveBeenCalledWith(
      "student@example.com",
      "Hackathon",
      new Date("2026-05-01T12:00:00.000Z"),
      "Hall A",
      expect.any(String),
    );
    expect(updateSetMock).toHaveBeenCalledWith({
      reminder24hEmailId: "24h-id",
      reminder1hEmailId: "1h-id",
    });
  });
});
