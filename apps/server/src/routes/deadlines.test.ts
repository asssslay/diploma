import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  selectResults,
  insertResults,
  updateResults,
  deleteResults,
  selectMock,
  insertMock,
  insertValuesMock,
  updateMock,
  updateSetMock,
  deleteMock,
  cancelScheduledEmailMock,
  scheduleDeadlineReminderMock,
} = vi.hoisted(() => {
  const selectResults: unknown[] = [];
  const insertResults: unknown[] = [];
  const updateResults: unknown[] = [];
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
    limit: vi.fn(() => selectLimitQuery),
    then: createThenable(selectResults).then,
  });

  const insertQuery = {
    returning: vi.fn(() => Promise.resolve(dequeue(insertResults))),
    then: createThenable(insertResults).then,
  };
  const insertValuesMock = vi.fn(() => insertQuery);

  const updateWhereQuery = {
    returning: vi.fn(() => Promise.resolve(dequeue(updateResults))),
    then: createThenable(updateResults).then,
  };
  const updateSetMock = vi.fn(() => ({
    where: vi.fn(() => updateWhereQuery),
  }));

  const deleteWhereQuery = {
    returning: vi.fn(() => Promise.resolve(dequeue(deleteResults))),
    then: createThenable(deleteResults).then,
  };

  return {
    selectResults,
    insertResults,
    updateResults,
    deleteResults,
    selectMock: vi.fn(() => selectQuery),
    insertMock: vi.fn(() => ({ values: insertValuesMock })),
    insertValuesMock,
    updateMock: vi.fn(() => ({ set: updateSetMock })),
    updateSetMock,
    deleteMock: vi.fn(() => ({ where: vi.fn(() => deleteWhereQuery) })),
    cancelScheduledEmailMock: vi.fn(),
    scheduleDeadlineReminderMock: vi.fn(),
  };
});

vi.mock("@my-better-t-app/db", () => ({
  db: {
    select: selectMock,
    insert: insertMock,
    update: updateMock,
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

vi.mock("@/lib/emails", () => ({
  cancelScheduledEmail: cancelScheduledEmailMock,
  scheduleDeadlineReminder: scheduleDeadlineReminderMock,
}));

import app from "./deadlines";

describe("deadlines routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectResults.length = 0;
    insertResults.length = 0;
    updateResults.length = 0;
    deleteResults.length = 0;
    cancelScheduledEmailMock.mockResolvedValue(true);
  });

  it("schedules both reminders when a deadline is created with notifications enabled", async () => {
    selectResults.push([{ email: "student@example.com" }], [{ notify: true }]);
    scheduleDeadlineReminderMock
      .mockResolvedValueOnce("reminder-24")
      .mockResolvedValueOnce("reminder-1");
    insertResults.push([
      {
        id: "deadline-1",
        title: "Algorithms exam",
      },
    ]);

    const response = await app.request("http://localhost/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Algorithms exam",
        dueAt: "2030-05-01T12:00:00.000Z",
      }),
    });

    expect(response.status).toBe(201);
    expect(scheduleDeadlineReminderMock).toHaveBeenNthCalledWith(
      1,
      "student@example.com",
      "Algorithms exam",
      new Date("2030-05-01T12:00:00.000Z"),
      24,
      expect.any(String),
    );
    expect(scheduleDeadlineReminderMock).toHaveBeenNthCalledWith(
      2,
      "student@example.com",
      "Algorithms exam",
      new Date("2030-05-01T12:00:00.000Z"),
      1,
      expect.any(String),
    );
    expect(insertValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        reminder24hEmailId: "reminder-24",
        reminder1hEmailId: "reminder-1",
      }),
    );
  });

  it("skips reminder scheduling when deadline notifications are disabled", async () => {
    selectResults.push([{ email: "student@example.com" }], [{ notify: false }]);
    insertResults.push([{ id: "deadline-2" }]);

    const response = await app.request("http://localhost/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Quiet deadline",
        dueAt: "2030-05-02T12:00:00.000Z",
      }),
    });

    expect(response.status).toBe(201);
    expect(scheduleDeadlineReminderMock).not.toHaveBeenCalled();
    expect(insertValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        reminder24hEmailId: null,
        reminder1hEmailId: null,
      }),
    );
  });

  it("returns 500 when deadline creation does not return a row", async () => {
    selectResults.push([{ email: "student@example.com" }], [{ notify: false }]);
    insertResults.push([]);

    const response = await app.request("http://localhost/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Missing row",
        dueAt: "2030-05-02T12:00:00.000Z",
      }),
    });

    expect(response.status).toBe(500);
    await expect(response.text()).resolves.toContain("Failed to create deadline");
  });

  it("re-syncs reminders when a deadline changes", async () => {
    selectResults.push(
      [
        {
          id: "deadline-1",
          title: "Old title",
          dueAt: new Date("2030-05-01T12:00:00.000Z"),
          reminder24hEmailId: "old-24",
          reminder1hEmailId: "old-1",
        },
      ],
      [{ email: "student@example.com" }],
      [{ notify: true }],
    );
    scheduleDeadlineReminderMock
      .mockResolvedValueOnce("new-24")
      .mockResolvedValueOnce("new-1");
    updateResults.push([
      {
        id: "deadline-1",
        title: "New title",
      },
    ]);

    const response = await app.request(
      "http://localhost/11111111-1111-4111-8111-111111111111",
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "New title",
          dueAt: "2030-05-03T12:00:00.000Z",
        }),
      },
    );

    expect(response.status).toBe(200);
    expect(cancelScheduledEmailMock).toHaveBeenCalledTimes(2);
    expect(cancelScheduledEmailMock).toHaveBeenCalledWith("old-24");
    expect(cancelScheduledEmailMock).toHaveBeenCalledWith("old-1");
    expect(updateSetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "New title",
        reminder24hEmailId: "new-24",
        reminder1hEmailId: "new-1",
      }),
    );
  });

  it("returns 404 when updating a missing deadline", async () => {
    selectResults.push([]);

    const response = await app.request(
      "http://localhost/11111111-1111-4111-8111-111111111111",
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "No deadline",
          dueAt: "2030-05-03T12:00:00.000Z",
        }),
      },
    );

    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toContain("Deadline not found");
  });

  it("cancels reminders when a deadline is deleted", async () => {
    deleteResults.push([
      {
        id: "deadline-1",
        reminder24hEmailId: "old-24",
        reminder1hEmailId: "old-1",
      },
    ]);

    const response = await app.request(
      "http://localhost/11111111-1111-4111-8111-111111111111",
      {
        method: "DELETE",
      },
    );

    expect(response.status).toBe(200);
    expect(cancelScheduledEmailMock).toHaveBeenCalledTimes(2);
    await expect(response.json()).resolves.toEqual({ success: true });
  });

  it("returns 404 when deleting a missing deadline", async () => {
    deleteResults.push([]);

    const response = await app.request(
      "http://localhost/11111111-1111-4111-8111-111111111111",
      {
        method: "DELETE",
      },
    );

    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toContain("Deadline not found");
  });
});
