import { hc } from "hono/client";
import type { AppType } from "server";
import { env } from "@my-better-t-app/env/web";
import { supabase } from "./supabase";
import type { ActivityGate } from "./activity-gate";

export type ApiErrorResponse = {
  success?: false;
  error?: string;
  code?: string;
  activityGate?: ActivityGate;
};

export async function getApiClient() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return hc<AppType>(env.VITE_SERVER_URL, {
    headers: {
      Authorization: `Bearer ${session?.access_token}`,
    },
  });
}

export async function readApiErrorResponse(
  response: Response,
): Promise<ApiErrorResponse | null> {
  try {
    const json = (await response.json()) as ApiErrorResponse;
    return json && typeof json === "object" ? json : null;
  } catch {
    return null;
  }
}
