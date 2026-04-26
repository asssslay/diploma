import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  selectResults,
  updateResults,
  selectMock,
  updateMock,
} = vi.hoisted(() => {
  const selectResults: unknown[] = [];
  const updateResults: unknown[] = [];

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

  const updateWhereQuery = {
    returning: vi.fn(() => Promise.resolve(dequeue(updateResults))),
    then: createThenable(updateResults).then,
  };

  return {
    selectResults,
    updateResults,
    selectMock: vi.fn(() => selectQuery),
    updateMock: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => updateWhereQuery) })) })),
  };
});

vi.mock("@my-better-t-app/db", () => ({
  db: {
    select: selectMock,
    update: updateMock,
  },
}));

vi.mock("@/middleware/auth", async () => {
  const { createAppMiddleware } = await import("@/lib/app");
  return {
    auth: createAppMiddleware(async (_c, next) => {
      await next();
    }),
  };
});

import app from "./news";

const postId = "44444444-4444-4444-8444-444444444444";

describe("news routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectResults.length = 0;
    updateResults.length = 0;
  });

  it("returns paginated news items with a total count", async () => {
    selectResults.push(
      [
        {
          id: postId,
          title: "Campus update",
          content: "Semester starts soon",
          authorName: "Admin",
        },
      ],
      [{ value: 1 }],
    );

    const response = await app.request("http://localhost/?page=1&pageSize=10", {
      method: "GET",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      total: 1,
      data: [{ id: postId }],
    });
  });

  it("increments view count and returns a post on detail requests", async () => {
    updateResults.push(undefined);
    selectResults.push([
      {
        id: postId,
        title: "Campus update",
        content: "Semester starts soon",
        authorName: "Admin",
        publishedAt: "2030-05-01T12:00:00.000Z",
        viewCount: 5,
        createdAt: "2030-05-01T12:00:00.000Z",
        updatedAt: "2030-05-01T12:00:00.000Z",
      },
    ]);

    const response = await app.request(`http://localhost/${postId}`, {
      method: "GET",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        id: postId,
        viewCount: 5,
      },
    });
  });

  it("returns 404 when a news post does not exist", async () => {
    updateResults.push(undefined);
    selectResults.push([]);

    const response = await app.request(`http://localhost/${postId}`, {
      method: "GET",
    });

    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toContain("News post not found");
  });
});
