import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  selectResults,
  insertResults,
  updateResults,
  deleteResults,
  selectMock,
  insertMock,
  updateMock,
  deleteMock,
  uploadMock,
  getPublicUrlMock,
  cancelAllEventRemindersMock,
  rescheduleAllEventRemindersMock,
} = vi.hoisted(() => {
  const selectResults: unknown[] = [];
  const insertResults: unknown[] = [];
  const updateResults: unknown[] = [];
  const deleteResults: unknown[] = [];

  const dequeue = (queue: unknown[]) => {
    if (queue.length === 0) throw new Error("No queued query result");
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
    leftJoin: vi.fn(() => selectQuery),
    innerJoin: vi.fn(() => selectQuery),
    orderBy: vi.fn(() => selectQuery),
    limit: vi.fn(() => selectLimitQuery),
    then: createThenable(selectResults).then,
  });

  const insertQuery = {
    returning: vi.fn(() => Promise.resolve(dequeue(insertResults))),
  };

  const updateQuery = {
    returning: vi.fn(() => Promise.resolve(dequeue(updateResults))),
  };

  const deleteQuery = {
    returning: vi.fn(() => Promise.resolve(dequeue(deleteResults))),
    then: createThenable(deleteResults).then,
  };

  return {
    selectResults,
    insertResults,
    updateResults,
    deleteResults,
    selectMock: vi.fn(() => selectQuery),
    insertMock: vi.fn(() => ({ values: vi.fn(() => insertQuery) })),
    updateMock: vi.fn(() => ({
      set: vi.fn(() => ({ where: vi.fn(() => updateQuery) })),
    })),
    deleteMock: vi.fn(() => ({ where: vi.fn(() => deleteQuery) })),
    uploadMock: vi.fn(),
    getPublicUrlMock: vi.fn(),
    cancelAllEventRemindersMock: vi.fn(),
    rescheduleAllEventRemindersMock: vi.fn(),
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

vi.mock("@my-better-t-app/db/supabase-admin", () => ({
  supabaseAdmin: {
    storage: {
      from: vi.fn(() => ({
        upload: uploadMock,
        getPublicUrl: getPublicUrlMock,
      })),
    },
  },
}));

vi.mock("@/middleware/auth", async () => {
  const { createAppMiddleware } = await import("@/lib/app");
  return {
    auth: createAppMiddleware(async (c, next) => {
      c.set("user", { id: "admin-1", email: "admin@example.com" });
      c.set("profile", {
        id: "admin-1",
        role: "admin",
        status: "approved",
      });
      await next();
    }),
    adminOnly: createAppMiddleware(async (_c, next) => {
      await next();
    }),
  };
});

vi.mock("@/lib/event-reminders", () => ({
  cancelAllEventReminders: cancelAllEventRemindersMock,
  rescheduleAllEventReminders: rescheduleAllEventRemindersMock,
}));

import app from "./events";

const eventId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("admin events routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectResults.length = 0;
    insertResults.length = 0;
    updateResults.length = 0;
    deleteResults.length = 0;
    uploadMock.mockResolvedValue({ error: null });
    getPublicUrlMock.mockReturnValue({
      data: { publicUrl: "https://cdn.example.com/event.png" },
    });
    rescheduleAllEventRemindersMock.mockResolvedValue(undefined);
    cancelAllEventRemindersMock.mockResolvedValue(undefined);
  });

  it("returns list data with registration counts", async () => {
    selectResults.push(
      [
        {
          id: eventId,
          title: "Hackathon",
          description: "Build things",
          imageUrl: null,
          authorName: "Admin",
          eventDate: "2030-06-01T12:00:00.000Z",
          location: "Main Hall",
          maxParticipants: 10,
        },
      ],
      [{ value: 1 }],
      [{ value: 4 }],
    );

    const response = await app.request("http://localhost/?page=1&pageSize=10");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      total: 1,
      data: [{ id: eventId, registrationCount: 4 }],
    });
  });

  it("validates uploaded image types", async () => {
    const formData = new FormData();
    formData.append("image", new File(["x"], "bad.txt", { type: "text/plain" }));

    const response = await app.request("http://localhost/upload-image", {
      method: "POST",
      body: formData,
    });

    expect(response.status).toBe(400);
    await expect(response.text()).resolves.toContain("Image must be JPEG, PNG, or WebP");
  });

  it("creates an event with the authenticated admin as author", async () => {
    insertResults.push([{ id: eventId, title: "New Event" }]);

    const response = await app.request("http://localhost/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "New Event",
        description: "Details",
        imageUrl: "https://cdn.example.com/event.png",
        eventDate: "2030-06-01T12:00:00.000Z",
        location: "Main Hall",
        maxParticipants: 50,
      }),
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { id: eventId, title: "New Event" },
    });
  });

  it("reschedules reminders only when date, title, or location changes", async () => {
    selectResults.push([
      {
        id: eventId,
        title: "Old title",
        eventDate: new Date("2030-06-01T12:00:00.000Z"),
        location: "Old Hall",
      },
    ]);
    updateResults.push([{ id: eventId }]);

    const response = await app.request(`http://localhost/${eventId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "New title",
        location: "New Hall",
      }),
    });

    expect(response.status).toBe(200);
    expect(rescheduleAllEventRemindersMock).toHaveBeenCalledWith(
      eventId,
      "New title",
      new Date("2030-06-01T12:00:00.000Z"),
      "New Hall",
    );
  });

  it("deletes an event after cancelling all reminders", async () => {
    selectResults.push([{ id: eventId }]);
    deleteResults.push([]);

    const response = await app.request(`http://localhost/${eventId}`, {
      method: "DELETE",
    });

    expect(response.status).toBe(200);
    expect(cancelAllEventRemindersMock).toHaveBeenCalledWith(eventId);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: { id: eventId },
    });
  });
});
