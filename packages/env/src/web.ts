import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export function createWebEnv(runtimeEnv: Record<string, string | undefined>) {
  return createEnv({
    clientPrefix: "VITE_",
    client: {
      VITE_SERVER_URL: z.url(),
      VITE_SUPABASE_URL: z.url(),
      VITE_SUPABASE_ANON_KEY: z.string().min(1),
    },
    runtimeEnv,
    emptyStringAsUndefined: true,
  });
}

function getDefaultWebRuntimeEnv() {
  return (
    (globalThis as { __TEST_IMPORT_META_ENV__?: Record<string, string | undefined> })
      .__TEST_IMPORT_META_ENV__ ?? (import.meta as any).env
  );
}

export const env = createWebEnv(getDefaultWebRuntimeEnv());
