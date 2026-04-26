import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

const { getUserMock, singleMock, eqMock, selectMock, fromMock } = vi.hoisted(
  () => {
    const singleMock = vi.fn();
    const eqMock = vi.fn(() => ({ single: singleMock }));
    const selectMock = vi.fn(() => ({ eq: eqMock }));
    const fromMock = vi.fn(() => ({ select: selectMock }));

    return {
      getUserMock: vi.fn(),
      singleMock,
      eqMock,
      selectMock,
      fromMock,
    };
  },
);

vi.mock("@my-better-t-app/db/supabase-admin", () => ({
  supabaseAdmin: {
    auth: {
      getUser: getUserMock,
    },
    from: fromMock,
  },
}));

import { adminOnly, auth } from "./auth";

function createApp() {
  const app = new Hono();

  app.use("/auth", auth);
  app.get("/auth", (c) => c.json({ success: true, user: c.get("user") }));

  app.use("/admin", auth, adminOnly);
  app.get("/admin", (c) => c.json({ success: true, profile: c.get("profile") }));

  return app;
}

describe("auth middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 for missing bearer tokens", async () => {
    const response = await createApp().request("http://localhost/auth");

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Missing or invalid authorization token",
    });
  });

  it("returns 401 for invalid tokens", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: new Error("bad") });

    const response = await createApp().request("http://localhost/auth", {
      headers: { Authorization: "Bearer invalid-token" },
    });

    expect(response.status).toBe(401);
  });

  it("attaches the authenticated user to the context", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-1", email: "user@example.com" } },
      error: null,
    });

    const response = await createApp().request("http://localhost/auth", {
      headers: { Authorization: "Bearer valid-token" },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      user: { id: "user-1", email: "user@example.com" },
    });
  });

  it("returns 403 for non-admin profiles", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    singleMock.mockResolvedValue({
      data: { id: "user-1", role: "student", status: "approved" },
    });

    const response = await createApp().request("http://localhost/admin", {
      headers: { Authorization: "Bearer valid-token" },
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Admin access required",
    });
  });

  it("allows admins through and attaches the profile", async () => {
    getUserMock.mockResolvedValue({
      data: { user: { id: "admin-1" } },
      error: null,
    });
    singleMock.mockResolvedValue({
      data: { id: "admin-1", role: "admin", status: "approved" },
    });

    const response = await createApp().request("http://localhost/admin", {
      headers: { Authorization: "Bearer valid-token" },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      profile: { id: "admin-1", role: "admin", status: "approved" },
    });
  });
});
