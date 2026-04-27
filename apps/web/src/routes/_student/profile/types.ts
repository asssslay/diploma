import type { InferResponseType } from "hono/client";
import { hc } from "hono/client";
import { z } from "zod";

import type { ActivityGate } from "@/lib/activity-gate";
import type { AppType } from "server";

type Client = ReturnType<typeof hc<AppType>>;
type MeEndpoint = Client["api"]["profile"]["me"]["$get"];
type MeResponseBase = Extract<
  InferResponseType<MeEndpoint>,
  { success: true }
>;

export type MeResponse = MeResponseBase & {
  data: MeResponseBase["data"] & {
    backgroundUrl: string | null;
    activityGate: ActivityGate;
  };
};

export type Profile = MeResponse["data"];

export const STATUS_BADGE = {
  pending: { variant: "outline" as const, label: "Pending" },
  approved: { variant: "default" as const, label: "Approved" },
  rejected: { variant: "destructive" as const, label: "Rejected" },
};

export const editSchema = z.object({
  fullName: z.string().min(1, { message: "Name is required" }).max(100),
  faculty: z.string().max(200).optional(),
  group: z.string().max(200).optional(),
  bio: z.string().max(1000).optional(),
  interests: z.string().optional(),
});

export type EditProfileValues = z.infer<typeof editSchema>;
export type EditFieldErrors = Partial<
  Record<keyof EditProfileValues, string>
>;
