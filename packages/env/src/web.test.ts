import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function getRuntimeEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    VITE_SERVER_URL: "https://api.example.com",
    VITE_SUPABASE_URL: "https://supabase.example.com",
    VITE_SUPABASE_ANON_KEY: "anon-key",
    ...overrides,
  };
}

describe("createWebEnv", () => {
  const originalEnv = { ...(globalThis as { __TEST_IMPORT_META_ENV__?: Record<string, string> }).__TEST_IMPORT_META_ENV__ };

  beforeEach(() => {
    vi.resetModules();
    (globalThis as { __TEST_IMPORT_META_ENV__?: Record<string, string> }).__TEST_IMPORT_META_ENV__ =
      getRuntimeEnv() as Record<string, string>;
  });

  afterEach(() => {
    (globalThis as { __TEST_IMPORT_META_ENV__?: Record<string, string> }).__TEST_IMPORT_META_ENV__ =
      originalEnv;
  });

  it("accepts valid client env values", async () => {
    const { createWebEnv } = await import("./web");
    const env = createWebEnv(getRuntimeEnv());

    expect(env.VITE_SERVER_URL).toBe("https://api.example.com");
  });

  it("rejects invalid urls", async () => {
    const { createWebEnv } = await import("./web");
    expect(() =>
      createWebEnv(getRuntimeEnv({ VITE_SUPABASE_URL: "invalid-url" })),
    ).toThrowError();
  });

  it("rejects missing required values", async () => {
    const { createWebEnv } = await import("./web");
    expect(() =>
      createWebEnv(getRuntimeEnv({ VITE_SUPABASE_ANON_KEY: undefined })),
    ).toThrowError();
  });
});
