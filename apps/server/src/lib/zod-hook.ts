import type { Hook } from "@hono/zod-validator";
import type { Env, Context } from "hono";

export const validationHook: Hook<unknown, Env, string> = (result, c: Context) => {
  if (!result.success) {
    return c.json(
      { success: false, error: result.error.issues },
      422,
    );
  }
};
