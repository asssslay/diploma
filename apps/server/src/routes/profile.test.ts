import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getActivityGateForUserMock,
  uploadMock,
  getPublicUrlMock,
  updateWhereMock,
  updateSetMock,
  updateMock,
} = vi.hoisted(() => {
  const uploadMock = vi.fn();
  const getPublicUrlMock = vi.fn();
  const updateWhereMock = vi.fn();
  const updateSetMock = vi.fn(() => ({ where: updateWhereMock }));
  const updateMock = vi.fn(() => ({ set: updateSetMock }));

  return {
    getActivityGateForUserMock: vi.fn(),
    uploadMock,
    getPublicUrlMock,
    updateWhereMock,
    updateSetMock,
    updateMock,
  };
});

vi.mock("@my-better-t-app/db", () => ({
  db: {
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

describe("profile routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateWhereMock.mockResolvedValue(undefined);
  });

  it("blocks background uploads until the event gate is unlocked", async () => {
    getActivityGateForUserMock.mockResolvedValue({
      profileCompletion: {
        isComplete: true,
        completedFields: 5,
        totalFields: 5,
        missingRequiredProfileFields: [],
      },
      commentsPosted: 1,
      personalization: {
        registeredEventsCount: 0,
        permissions: { canChangeBackground: false },
      },
      permissions: {
        canCommentOnDiscussions: true,
        canCreateDiscussions: true,
      },
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

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      code: "PROFILE_BACKGROUND_REQUIRES_EVENT",
    });
  });

  it("validates avatar file types", async () => {
    const formData = new FormData();
    formData.append(
      "avatar",
      new File(["text"], "avatar.txt", { type: "text/plain" }),
    );

    const response = await app.request("http://localhost/upload-avatar", {
      method: "POST",
      body: formData,
    });

    expect(response.status).toBe(400);
    await expect(response.text()).resolves.toContain(
      "Avatar must be JPEG, PNG, or WebP",
    );
  });

  it("uploads a valid avatar and persists the generated public url", async () => {
    uploadMock.mockResolvedValue({ error: null });
    getPublicUrlMock.mockReturnValue({
      data: { publicUrl: "https://cdn.example.com/avatar.png" },
    });

    const formData = new FormData();
    formData.append(
      "avatar",
      new File(["image"], "avatar.png", { type: "image/png" }),
    );

    const response = await app.request("http://localhost/upload-avatar", {
      method: "POST",
      body: formData,
    });

    expect(response.status).toBe(200);
    expect(updateMock).toHaveBeenCalledTimes(1);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.data.avatarUrl).toContain("https://cdn.example.com/avatar.png");
  });
});
