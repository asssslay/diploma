import { hc } from "hono/client";
import type { AppType } from "server";
import { env } from "@my-better-t-app/env/web";
import { supabase } from "./supabase";

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
