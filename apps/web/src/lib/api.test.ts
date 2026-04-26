import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionMock, hcMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  hcMock: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: getSessionMock,
    },
  },
}));

vi.mock("@my-better-t-app/env/web", () => ({
  env: {
    VITE_SERVER_URL: "https://api.example.com",
  },
}));

vi.mock("hono/client", () => ({
  hc: hcMock,
}));

import { getApiClient, readApiErrorResponse } from "./api";

describe("api helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates an api client with the bearer token from the session", async () => {
    getSessionMock.mockResolvedValue({
      data: { session: { access_token: "access-token" } },
    });
    hcMock.mockReturnValue({ api: {} });

    const client = await getApiClient();

    expect(client).toEqual({ api: {} });
    expect(hcMock).toHaveBeenCalledWith("https://api.example.com", {
      headers: {
        Authorization: "Bearer access-token",
      },
    });
  });

  it("returns null for invalid json error payloads", async () => {
    const response = new Response("not json", {
      headers: { "content-type": "application/json" },
    });

    await expect(readApiErrorResponse(response)).resolves.toBeNull();
  });

  it("returns null for non-object payloads", async () => {
    const response = new Response('"failure"', {
      headers: { "content-type": "application/json" },
    });

    await expect(readApiErrorResponse(response)).resolves.toBeNull();
  });

  it("returns parsed object payloads", async () => {
    const response = new Response(JSON.stringify({ success: false, error: "Boom" }), {
      headers: { "content-type": "application/json" },
    });

    await expect(readApiErrorResponse(response)).resolves.toEqual({
      success: false,
      error: "Boom",
    });
  });
});
