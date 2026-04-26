import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export function createServerEnv(runtimeEnv: Record<string, string | undefined>) {
  return createEnv({
    server: {
      CORS_ORIGIN: z.url(),
      DATABASE_URL: z.url(),
      SUPABASE_URL: z.url(),
      SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
      RESEND_API_KEY: z.string().min(1),
      EMAIL_FROM: z.string().min(1),
      NODE_ENV: z
        .enum(["development", "production", "test"])
        .default("development"),
    },
    runtimeEnv,
    emptyStringAsUndefined: true,
  });
}

export const env = createServerEnv(process.env);
