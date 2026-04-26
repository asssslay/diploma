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

  const updateWhereQuery = {
    returning: vi.fn(() => Promise.resolve(dequeue(updateResults))),
    then: createThenable(updateResults).then,
  };

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
    insertMock: vi.fn(() => ({ values: vi.fn(() => insertQuery) })),
    updateMock: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => updateWhereQuery) })) })),
    deleteMock: vi.fn(() => ({ where: vi.fn(() => deleteWhereQuery) })),
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

import app from "./notes";

const noteId = "33333333-3333-4333-8333-333333333333";

describe("notes routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectResults.length = 0;
    insertResults.length = 0;
    updateResults.length = 0;
    deleteResults.length = 0;
  });

  it("returns paginated notes with a total count", async () => {
    selectResults.push(
      [
        {
          id: noteId,
          title: "Lecture notes",
          content: "Distributed systems",
          createdAt: "2030-05-01T12:00:00.000Z",
          updatedAt: "2030-05-01T12:00:00.000Z",
        },
      ],
      [{ value: 1 }],
    );

    const response = await app.request("http://localhost/?page=1&pageSize=20", {
      method: "GET",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      total: 1,
      page: 1,
      pageSize: 20,
      data: [{ id: noteId }],
    });
  });

  it("creates a note", async () => {
    insertResults.push([
      {
        id: noteId,
        title: "New note",
        content: "Remember this",
      },
    ]);

    const response = await app.request("http://localhost/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "New note",
        content: "Remember this",
      }),
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        id: noteId,
        title: "New note",
      },
    });
  });

  it("returns 404 when updating a missing note", async () => {
    updateResults.push([]);

    const response = await app.request(`http://localhost/${noteId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Updated title" }),
    });

    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toContain("Note not found");
  });

  it("deletes a note", async () => {
    deleteResults.push([{ id: noteId }]);

    const response = await app.request(`http://localhost/${noteId}`, {
      method: "DELETE",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
  });
});
