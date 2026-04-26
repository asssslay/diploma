import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function getRuntimeEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    CORS_ORIGIN: "https://example.com",
    DATABASE_URL: "https://db.example.com",
    SUPABASE_URL: "https://supabase.example.com",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    RESEND_API_KEY: "resend-api-key",
    EMAIL_FROM: "noreply@example.com",
    NODE_ENV: "test",
    ...overrides,
  };
}

describe("createServerEnv", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    Object.assign(process.env, getRuntimeEnv());
  });

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    }
    Object.assign(process.env, originalEnv);
  });

  it("accepts valid server env values", async () => {
    const { createServerEnv } = await import("./server");
    const env = createServerEnv(getRuntimeEnv());

    expect(env.CORS_ORIGIN).toBe("https://example.com");
    expect(env.NODE_ENV).toBe("test");
  });

  it("rejects invalid urls", async () => {
    const { createServerEnv } = await import("./server");
    expect(() =>
      createServerEnv(getRuntimeEnv({ DATABASE_URL: "not-a-url" })),
    ).toThrowError();
  });

  it("rejects missing required values", async () => {
    const { createServerEnv } = await import("./server");
    expect(() =>
      createServerEnv(getRuntimeEnv({ RESEND_API_KEY: undefined })),
    ).toThrowError();
  });

  it("treats empty strings as undefined", async () => {
    const { createServerEnv } = await import("./server");
    expect(() =>
      createServerEnv(getRuntimeEnv({ EMAIL_FROM: "" })),
    ).toThrowError();
  });
});
