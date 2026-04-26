import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getActivityGateForUserMock,
  selectMock,
  insertMock,
  updateMock,
  deleteMock,
  selectQueue,
  insertQueue,
  updateQueue,
  deleteQueue,
} = vi.hoisted(() => {
  const selectQueue: unknown[] = [];
  const insertQueue: unknown[] = [];
  const updateQueue: unknown[] = [];
  const deleteQueue: unknown[] = [];

  const createChain = (queue: unknown[]) => {
    const chain: Record<string, unknown> = {};

    for (const method of [
      "from",
      "leftJoin",
      "innerJoin",
      "where",
      "groupBy",
      "having",
      "orderBy",
      "limit",
      "offset",
      "set",
      "values",
      "returning",
    ]) {
      chain[method] = vi.fn(() => chain);
    }

    chain.then = (resolve: (value: unknown) => unknown) =>
      Promise.resolve(resolve(queue.shift() ?? []));
    chain.catch = Promise.prototype.catch.bind(Promise.resolve());
    chain.finally = Promise.prototype.finally.bind(Promise.resolve());

    return chain;
  };

  return {
    getActivityGateForUserMock: vi.fn(),
    selectQueue,
    insertQueue,
    updateQueue,
    deleteQueue,
    selectMock: vi.fn(() => createChain(selectQueue)),
    insertMock: vi.fn(() => createChain(insertQueue)),
    updateMock: vi.fn(() => createChain(updateQueue)),
    deleteMock: vi.fn(() => createChain(deleteQueue)),
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

vi.mock("@/lib/activity-gate", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/activity-gate")>("./../lib/activity-gate");
  return {
    ...actual,
    getActivityGateForUser: getActivityGateForUserMock,
  };
});

import app from "./discussions";

const discussionId = "11111111-1111-4111-8111-111111111111";
const commentId = "22222222-2222-4222-8222-222222222222";

const unlockedGate = {
  profileCompletion: {
    isComplete: true,
    completedFields: 5,
    totalFields: 5,
    missingRequiredProfileFields: [],
  },
  commentsPosted: 3,
  personalization: {
    registeredEventsCount: 1,
    permissions: { canChangeBackground: true },
  },
  permissions: {
    canCommentOnDiscussions: true,
    canCreateDiscussions: true,
  },
};

describe("discussions routes additional coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectQueue.length = 0;
    insertQueue.length = 0;
    updateQueue.length = 0;
    deleteQueue.length = 0;
    getActivityGateForUserMock.mockResolvedValue(unlockedGate);
  });

  it("returns discussion list items with counts and viewer gate", async () => {
    selectQueue.push(
      [
        {
          id: discussionId,
          title: "Distributed Systems",
          content: "Notes about quorum",
          category: "academic",
          authorId: "author-1",
          authorName: "Alice",
          viewCount: 12,
          createdAt: "2030-05-01T09:00:00.000Z",
          updatedAt: "2030-05-02T09:00:00.000Z",
        },
      ],
      [{ value: 1 }],
      [{ value: 2 }],
      [{ value: 3 }],
    );

    const response = await app.request(
      "http://localhost/?page=1&pageSize=10&category=academic",
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: [
        {
          id: discussionId,
          title: "Distributed Systems",
          content: "Notes about quorum",
          category: "academic",
          authorId: "author-1",
          authorName: "Alice",
          viewCount: 12,
          createdAt: "2030-05-01T09:00:00.000Z",
          updatedAt: "2030-05-02T09:00:00.000Z",
          commentCount: 2,
          reactionsCount: 3,
        },
      ],
      viewerActivityGate: unlockedGate,
      total: 1,
      page: 1,
      pageSize: 10,
    });
  });

  it("returns discussion detail with reaction state and helpful comment markers", async () => {
    updateQueue.push([]);
    selectQueue.push(
      [
        {
          id: discussionId,
          title: "Exam prep",
          content: "Thread body",
          category: "help",
          authorId: "author-1",
          authorName: "Alice",
          viewCount: 7,
          createdAt: "2030-05-01T09:00:00.000Z",
          updatedAt: "2030-05-02T09:00:00.000Z",
        },
      ],
      [{ value: 4 }],
      [{ value: 1 }],
      [
        {
          id: commentId,
          content: "Try the sample exam.",
          authorId: "author-2",
          authorName: "Bob",
          createdAt: "2030-05-03T09:00:00.000Z",
          updatedAt: "2030-05-03T09:00:00.000Z",
        },
      ],
      [{ authorId: "author-2" }],
      [{ value: 10 }],
      [{ value: 1 }],
    );

    const response = await app.request(`http://localhost/${discussionId}`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      viewerActivityGate: unlockedGate,
      data: {
        id: discussionId,
        title: "Exam prep",
        content: "Thread body",
        category: "help",
        authorId: "author-1",
        authorName: "Alice",
        viewCount: 7,
        createdAt: "2030-05-01T09:00:00.000Z",
        updatedAt: "2030-05-02T09:00:00.000Z",
        reactionsCount: 4,
        isReacted: true,
        comments: [
          {
            id: commentId,
            content: "Try the sample exam.",
            authorId: "author-2",
            authorName: "Bob",
            createdAt: "2030-05-03T09:00:00.000Z",
            updatedAt: "2030-05-03T09:00:00.000Z",
            authorHasHelpfulMarker: true,
            reactionsCount: 10,
            isReacted: true,
          },
        ],
      },
    });
  });

  it("forbids editing another user's discussion", async () => {
    selectQueue.push([{ id: discussionId, authorId: "other-user" }]);

    const response = await app.request(`http://localhost/${discussionId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Updated title" }),
    });

    expect(response.status).toBe(403);
    await expect(response.text()).resolves.toContain(
      "You can only edit your own discussions",
    );
  });

  it("returns not found when removing a missing discussion reaction", async () => {
    deleteQueue.push([]);

    const response = await app.request(`http://localhost/${discussionId}/react`, {
      method: "DELETE",
    });

    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toContain("Reaction not found");
  });

  it("marks a helpful achievement when a comment author crosses the reaction threshold", async () => {
    selectQueue.push(
      [{ authorId: "author-2", authorName: "Bob" }],
      [],
      [],
      [{ authorId: "author-2" }],
    );
    insertQueue.push([]);

    const response = await app.request(
      `http://localhost/${discussionId}/comments/${commentId}/react`,
      {
        method: "POST",
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        reacted: true,
        helpfulMarker: {
          authorId: "author-2",
          authorName: "Bob",
          authorHasHelpfulMarker: true,
          achievementEarned: true,
        },
      },
    });
  });

  it("forbids editing another user's comment", async () => {
    selectQueue.push([{ id: commentId, authorId: "other-user" }]);

    const response = await app.request(
      `http://localhost/${discussionId}/comments/${commentId}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: "Updated comment" }),
      },
    );

    expect(response.status).toBe(403);
    await expect(response.text()).resolves.toContain(
      "You can only edit your own comments",
    );
  });

  it("returns not found when deleting a missing comment", async () => {
    selectQueue.push([]);

    const response = await app.request(
      `http://localhost/${discussionId}/comments/${commentId}`,
      {
        method: "DELETE",
      },
    );

    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toContain("Comment not found");
  });

  it("returns not found when commenting on a missing discussion", async () => {
    selectQueue.push([]);

    const response = await app.request(`http://localhost/${discussionId}/comments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "Is this still open?" }),
    });

    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toContain("Discussion not found");
  });

  it("returns 500 when a comment insert does not produce an id", async () => {
    selectQueue.push([{ id: discussionId }]);
    insertQueue.push([{}]);

    const response = await app.request(`http://localhost/${discussionId}/comments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "First!" }),
    });

    expect(response.status).toBe(500);
    await expect(response.text()).resolves.toContain("Failed to create comment");
  });

  it("removes a comment reaction and returns the helpful marker state", async () => {
    selectQueue.push(
      [{ authorId: "author-2", authorName: "Bob" }],
      [{ authorId: "author-2" }],
    );
    deleteQueue.push([{}]);

    const response = await app.request(
      `http://localhost/${discussionId}/comments/${commentId}/react`,
      {
        method: "DELETE",
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        reacted: false,
        helpfulMarker: {
          authorId: "author-2",
          authorName: "Bob",
          authorHasHelpfulMarker: true,
          achievementEarned: false,
        },
      },
    });
  });
});
