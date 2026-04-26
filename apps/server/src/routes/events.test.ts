import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  selectResults,
  insertResults,
  deleteResults,
  selectMock,
  insertMock,
  insertValuesMock,
  deleteMock,
  scheduleBothEventRemindersMock,
  cancelBothEventRemindersMock,
} = vi.hoisted(() => {
  const selectResults: unknown[] = [];
  const insertResults: unknown[] = [];
  const deleteResults: unknown[] = [];

  const dequeue = (queue: unknown[]) => {
    if (queue.length === 0) {
      throw new Error("No queued query result");
    }
    return queue.shift();
  };

  const createThenable = (queue: unknown[]) => ({
    then: (
      resolve: (value: unknown) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve(dequeue(queue)).then(resolve, reject),
  });

  const selectLimitQuery = {
    offset: vi.fn(() => Promise.resolve(dequeue(selectResults))),
    then: createThenable(selectResults).then,
  };

  const selectQuery: Record<string, unknown> = {};
  Object.assign(selectQuery, {
    from: vi.fn(() => selectQuery),
    where: vi.fn(() => selectQuery),
    orderBy: vi.fn(() => selectQuery),
    leftJoin: vi.fn(() => selectQuery),
    limit: vi.fn(() => selectLimitQuery),
    then: createThenable(selectResults).then,
  });

  const insertQuery = {
    returning: vi.fn(() => Promise.resolve(dequeue(insertResults))),
    then: createThenable(insertResults).then,
  };
  const insertValuesMock = vi.fn(() => insertQuery);

  const deleteWhereQuery = {
    returning: vi.fn(() => Promise.resolve(dequeue(deleteResults))),
    then: createThenable(deleteResults).then,
  };

  return {
    selectResults,
    insertResults,
    deleteResults,
    selectMock: vi.fn(() => selectQuery),
    insertMock: vi.fn(() => ({ values: insertValuesMock })),
    insertValuesMock,
    deleteMock: vi.fn(() => ({ where: vi.fn(() => deleteWhereQuery) })),
    scheduleBothEventRemindersMock: vi.fn(),
    cancelBothEventRemindersMock: vi.fn(),
  };
});

vi.mock("@my-better-t-app/db", () => ({
  db: {
    select: selectMock,
    insert: insertMock,
    delete: deleteMock,
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

vi.mock("@/lib/event-reminders", () => ({
  cancelBothEventReminders: cancelBothEventRemindersMock,
  scheduleBothEventReminders: scheduleBothEventRemindersMock,
}));

import app from "./events";

const eventId = "22222222-2222-4222-8222-222222222222";

describe("events routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectResults.length = 0;
    insertResults.length = 0;
    deleteResults.length = 0;
  });

  it("returns event details with registration metadata", async () => {
    selectResults.push(
      [
        {
          id: eventId,
          title: "Hackathon",
          description: "Build something",
          imageUrl: null,
          authorName: "Admin",
          eventDate: "2030-06-01T12:00:00.000Z",
          location: "Main Hall",
          maxParticipants: 50,
          createdAt: "2030-05-01T12:00:00.000Z",
          updatedAt: "2030-05-01T12:00:00.000Z",
        },
      ],
      [{ value: 7 }],
      [{ value: 1 }],
    );

    const response = await app.request(`http://localhost/${eventId}`, {
      method: "GET",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        id: eventId,
        registrationCount: 7,
        isRegistered: true,
      },
    });
  });

  it("returns 404 when registering for a missing event", async () => {
    selectResults.push([]);

    const response = await app.request(`http://localhost/${eventId}/register`, {
      method: "POST",
    });

    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toContain("Event not found");
  });

  it("schedules reminders and stores ids when registration succeeds", async () => {
    selectResults.push(
      [
        {
          id: eventId,
          title: "Hackathon",
          eventDate: new Date("2030-06-01T12:00:00.000Z"),
          location: "Main Hall",
          maxParticipants: 50,
        },
      ],
      [],
      [{ value: 3 }],
      [{ email: "student@example.com" }],
      [{ notify: true }],
    );
    scheduleBothEventRemindersMock.mockResolvedValueOnce({
      reminder24hEmailId: "event-24",
      reminder1hEmailId: "event-1",
    });
    insertResults.push(undefined);

    const response = await app.request(`http://localhost/${eventId}/register`, {
      method: "POST",
    });

    expect(response.status).toBe(200);
    expect(scheduleBothEventRemindersMock).toHaveBeenCalledWith(
      "student@example.com",
      "Hackathon",
      new Date("2030-06-01T12:00:00.000Z"),
      "Main Hall",
      expect.any(String),
    );
    expect(insertValuesMock).toHaveBeenCalledWith({
      eventId,
      studentId: "user-1",
      reminder24hEmailId: "event-24",
      reminder1hEmailId: "event-1",
    });
  });

  it("cancels reminder ids when a registration is removed", async () => {
    deleteResults.push([
      {
        reminder24hEmailId: "event-24",
        reminder1hEmailId: "event-1",
      },
    ]);

    const response = await app.request(`http://localhost/${eventId}/register`, {
      method: "DELETE",
    });

    expect(response.status).toBe(200);
    expect(cancelBothEventRemindersMock).toHaveBeenCalledWith({
      reminder24hEmailId: "event-24",
      reminder1hEmailId: "event-1",
    });
  });
});
