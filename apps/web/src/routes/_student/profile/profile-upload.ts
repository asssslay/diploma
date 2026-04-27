import { env } from "@my-better-t-app/env/web";

import { supabase } from "@/lib/supabase";

type UploadProfileAssetParams = {
  endpoint: "/api/profile/upload-avatar" | "/api/profile/upload-background";
  fieldName: "avatar" | "background";
  file: File;
};

export async function uploadProfileAsset({
  endpoint,
  fieldName,
  file,
}: UploadProfileAssetParams) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const formData = new FormData();
  formData.append(fieldName, file);

  return fetch(`${env.VITE_SERVER_URL}${endpoint}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session?.access_token}` },
    body: formData,
  });
}
