import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getActivityGateForUserMock,
  selectResults,
  selectMock,
  updateWhereMock,
  updateSetMock,
  updateMock,
  uploadMock,
  getPublicUrlMock,
} = vi.hoisted(() => {
  const selectResults: unknown[] = [];

  const dequeue = (queue: unknown[]) => {
    if (queue.length === 0) {
      throw new Error("No queued select result");
    }
    return queue.shift();
  };

  const createThenable = (queue: unknown[]) => ({
    then: (
      resolve: (value: unknown) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve(dequeue(queue)).then(resolve, reject),
  });

  const selectQuery: Record<string, unknown> = {};
  Object.assign(selectQuery, {
    from: vi.fn(() => selectQuery),
    leftJoin: vi.fn(() => selectQuery),
    where: vi.fn(() => selectQuery),
    limit: vi.fn(() => selectQuery),
    then: createThenable(selectResults).then,
  });

  const updateWhereMock = vi.fn();
  const updateSetMock = vi.fn(() => ({ where: updateWhereMock }));
  const updateMock = vi.fn(() => ({ set: updateSetMock }));

  return {
    getActivityGateForUserMock: vi.fn(),
    selectResults,
    selectMock: vi.fn(() => selectQuery),
    updateWhereMock,
    updateSetMock,
    updateMock,
    uploadMock: vi.fn(),
    getPublicUrlMock: vi.fn(),
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

import app from "./profile";

const unlockedGate = {
  profileCompletion: {
    isComplete: true,
    completedFields: 5,
    totalFields: 5,
    missingRequiredProfileFields: [],
  },
  commentsPosted: 2,
  personalization: {
    registeredEventsCount: 1,
    permissions: { canChangeBackground: true },
  },
  permissions: {
    canCommentOnDiscussions: true,
    canCreateDiscussions: true,
  },
};

describe("profile routes additional coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectResults.length = 0;
    updateWhereMock.mockResolvedValue(undefined);
    getActivityGateForUserMock.mockResolvedValue(unlockedGate);
  });

  it("returns the authenticated profile with activity gate data", async () => {
    selectResults.push([
      {
        id: "user-1",
        email: "user@example.com",
        fullName: "Alice Johnson",
        role: "student",
        status: "approved",
        createdAt: "2030-05-01T12:00:00.000Z",
        faculty: "Computer Science",
        group: "CS-101",
        avatarUrl: null,
        backgroundUrl: null,
        bio: "Enjoys systems.",
        interests: ["AI"],
      },
    ]);

    const response = await app.request("http://localhost/me");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        id: "user-1",
        email: "user@example.com",
        fullName: "Alice Johnson",
        role: "student",
        status: "approved",
        createdAt: "2030-05-01T12:00:00.000Z",
        faculty: "Computer Science",
        group: "CS-101",
        avatarUrl: null,
        backgroundUrl: null,
        bio: "Enjoys systems.",
        interests: ["AI"],
        activityGate: unlockedGate,
      },
    });
  });

  it("updates profile fields and returns the refreshed profile", async () => {
    selectResults.push([
      {
        id: "user-1",
        email: "user@example.com",
        fullName: "Alice Updated",
        role: "student",
        status: "approved",
        createdAt: "2030-05-01T12:00:00.000Z",
        faculty: "Computer Science",
        group: "CS-201",
        avatarUrl: "https://cdn.example.com/avatar.png",
        backgroundUrl: null,
        bio: "Updated bio",
        interests: ["AI", "Databases"],
      },
    ]);

    const response = await app.request("http://localhost/me", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fullName: "Alice Updated",
        group: "CS-201",
        bio: "Updated bio",
        interests: ["AI", "Databases"],
      }),
    });

    expect(response.status).toBe(200);
    expect(updateMock).toHaveBeenCalledTimes(2);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        fullName: "Alice Updated",
        group: "CS-201",
        bio: "Updated bio",
        interests: ["AI", "Databases"],
        activityGate: unlockedGate,
      },
    });
  });

  it("uploads a valid background image and persists the generated public url", async () => {
    uploadMock.mockResolvedValue({ error: null });
    getPublicUrlMock.mockReturnValue({
      data: { publicUrl: "https://cdn.example.com/background.png" },
    });

    const formData = new FormData();
    formData.append(
      "background",
      new File(["image"], "background.png", { type: "image/png" }),
    );

    const response = await app.request("http://localhost/upload-background", {
      method: "POST",
      body: formData,
    });

    expect(response.status).toBe(200);
    expect(updateSetMock).toHaveBeenCalledWith({
      backgroundUrl: expect.stringContaining(
        "https://cdn.example.com/background.png",
      ),
    });
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        backgroundUrl: expect.stringContaining(
          "https://cdn.example.com/background.png",
        ),
        activityGate: unlockedGate,
      },
    });
  });
});
