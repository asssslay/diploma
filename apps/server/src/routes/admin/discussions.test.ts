import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  selectResults,
  deleteResults,
  selectMock,
  deleteMock,
} = vi.hoisted(() => {
  const selectResults: unknown[] = [];
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
    orderBy: vi.fn(() => selectQuery),
    limit: vi.fn(() => selectLimitQuery),
    then: createThenable(selectResults).then,
  });

  return {
    selectResults,
    deleteResults,
    selectMock: vi.fn(() => selectQuery),
    deleteMock: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve(dequeue(deleteResults))),
      })),
    })),
  };
});

vi.mock("@my-better-t-app/db", () => ({
  db: {
    select: selectMock,
    delete: deleteMock,
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

import app from "./discussions";

const discussionId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const commentId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

describe("admin discussions routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectResults.length = 0;
    deleteResults.length = 0;
  });

  it("lists discussions with comment counts", async () => {
    selectResults.push(
      [{ id: discussionId, title: "Welcome", category: "general" }],
      [{ value: 1 }],
      [{ value: 3 }],
    );

    const response = await app.request("http://localhost/?page=1&pageSize=10");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      total: 1,
      data: [{ id: discussionId, commentCount: 3 }],
    });
  });

  it("returns detail data with joined comments", async () => {
    selectResults.push(
      [{ id: discussionId, title: "Welcome", content: "Hello" }],
      [{ id: commentId, content: "Hi there" }],
    );

    const response = await app.request(`http://localhost/${discussionId}`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        id: discussionId,
        comments: [{ id: commentId }],
        commentCount: 1,
      },
    });
  });

  it("returns 404 when deleting a missing discussion", async () => {
    deleteResults.push([]);

    const response = await app.request(`http://localhost/${discussionId}`, {
      method: "DELETE",
    });

    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toContain("Discussion not found");
  });

  it("deletes a comment by id", async () => {
    deleteResults.push([{ id: commentId }]);

    const response = await app.request(
      `http://localhost/${discussionId}/comments/${commentId}`,
      {
        method: "DELETE",
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: { id: commentId },
    });
  });
});
