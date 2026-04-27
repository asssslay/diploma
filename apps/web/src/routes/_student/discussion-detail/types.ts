import type { InferResponseType } from "hono/client";
import { hc } from "hono/client";

import type { ActivityGate } from "@/lib/activity-gate";
import type { AppType } from "server";

type Client = ReturnType<typeof hc<AppType>>;
type DetailEndpoint = Client["api"]["discussions"][":id"]["$get"];
type DetailResponseBase = Extract<
  InferResponseType<DetailEndpoint>,
  { success: true }
>;

export type DetailComment = DetailResponseBase["data"]["comments"][number] & {
  authorHasHelpfulMarker: boolean;
};

export type DiscussionDetail = Omit<DetailResponseBase["data"], "comments"> & {
  comments: DetailComment[];
};

export type DetailResponse = DetailResponseBase & {
  viewerActivityGate: ActivityGate;
  data: DiscussionDetail;
};

export type Comment = DiscussionDetail["comments"][number];

export type ServerComment = Omit<
  Comment,
  "reactionsCount" | "isReacted" | "authorHasHelpfulMarker"
>;

export type CreatedComment = ServerComment &
  Pick<Comment, "authorHasHelpfulMarker">;

export type HelpfulMarkerReactionResult = {
  success: true;
  data: {
    reacted: boolean;
    helpfulMarker?: {
      authorId: string;
      authorName: string | null;
      authorHasHelpfulMarker: boolean;
      achievementEarned: boolean;
    };
  };
};

export type DiscussionCategory = DiscussionDetail["category"];

export const HELPFUL_REACTION_THRESHOLD = 10;

export const DISCUSSION_CATEGORIES = [
  "general",
  "academic",
  "social",
  "help",
  "feedback",
] as const satisfies readonly DiscussionCategory[];

export const CATEGORY_COLORS: Record<DiscussionCategory, string> = {
  general: "bg-secondary text-secondary-foreground",
  academic: "bg-accent text-accent-foreground",
  social: "bg-primary/10 text-primary",
  help: "bg-destructive/10 text-destructive",
  feedback: "bg-chart-1/20 text-foreground",
};
