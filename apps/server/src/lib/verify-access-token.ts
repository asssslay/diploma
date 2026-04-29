import { supabaseAdmin } from "@my-better-t-app/db/supabase-admin";

export type AuthenticatedUser = {
  id: string;
  email?: string;
};

export async function verifyAccessToken(
  token: string,
): Promise<AuthenticatedUser | null> {
  const { data, error } = await supabaseAdmin.auth.getClaims(token);

  if (error || !data?.claims) {
    return null;
  }

  const { claims } = data;

  if (typeof claims.sub !== "string" || claims.sub.length === 0) {
    return null;
  }

  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : undefined,
  };
}
