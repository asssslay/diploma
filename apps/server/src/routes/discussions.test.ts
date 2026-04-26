import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getActivityGateForUserMock,
  selectLimitMock,
  selectWhereMock,
  selectFromMock,
  selectMock,
  insertValuesMock,
  insertReturningMock,
  insertMock,
} = vi.hoisted(() => {
  const selectLimitMock = vi.fn();
  const selectWhereMock = vi.fn(() => ({ limit: selectLimitMock }));
  const selectFromMock = vi.fn(() => ({ where: selectWhereMock }));
  const selectMock = vi.fn(() => ({ from: selectFromMock }));

  const insertReturningMock = vi.fn();
  const insertValuesMock = vi.fn(() => ({ returning: insertReturningMock }));
  const insertMock = vi.fn(() => ({ values: insertValuesMock }));

  return {
    getActivityGateForUserMock: vi.fn(),
    selectLimitMock,
    selectWhereMock,
    selectFromMock,
    selectMock,
    insertValuesMock,
    insertReturningMock,
    insertMock,
  };
});

vi.mock("@my-better-t-app/db", () => ({
  db: {
    select: selectMock,
    insert: insertMock,
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

const lockedCommentGate = {
  profileCompletion: {
    isComplete: false,
    completedFields: 2,
    totalFields: 5,
    missingRequiredProfileFields: ["fullName"],
  },
  commentsPosted: 0,
  personalization: {
    registeredEventsCount: 0,
    permissions: { canChangeBackground: false },
  },
  permissions: {
    canCommentOnDiscussions: false,
    canCreateDiscussions: false,
  },
};

describe("discussions routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks discussion creation when the gate is locked", async () => {
    getActivityGateForUserMock.mockResolvedValue(lockedCommentGate);

    const response = await app.request("http://localhost/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Need help",
        content: "Question",
        category: "help",
      }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: "DISCUSSION_CREATION_REQUIRES_COMMENT",
      activityGate: lockedCommentGate,
    });
  });

  it("blocks comment creation until profile completion allows comments", async () => {
    getActivityGateForUserMock.mockResolvedValue(lockedCommentGate);

    const response = await app.request(`http://localhost/${discussionId}/comments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: "First comment" }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: "PROFILE_INCOMPLETE_FOR_COMMENTS",
      activityGate: lockedCommentGate,
    });
  });

  it("returns conflict when a user already reacted", async () => {
    selectLimitMock.mockResolvedValueOnce([{ id: "reaction-1" }]);

    const response = await app.request(`http://localhost/${discussionId}/react`, {
      method: "POST",
    });

    expect(response.status).toBe(409);
    await expect(response.text()).resolves.toContain("Already reacted");
  });

  it("creates a discussion when the gate is unlocked", async () => {
    getActivityGateForUserMock.mockResolvedValue({
      ...lockedCommentGate,
      permissions: {
        canCommentOnDiscussions: true,
        canCreateDiscussions: true,
      },
    });
    insertReturningMock.mockResolvedValueOnce([
      {
        id: "discussion-1",
        title: "New topic",
      },
    ]);

    const response = await app.request("http://localhost/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "New topic",
        content: "Hello",
        category: "general",
      }),
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        id: "discussion-1",
        title: "New topic",
      },
    });
  });
});
