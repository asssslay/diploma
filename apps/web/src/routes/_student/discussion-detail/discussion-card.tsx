import { Eye, Heart, Pencil, User } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatTime, isEdited } from "@/lib/utils";

import { CATEGORY_COLORS } from "./types";
import type { DiscussionDetail } from "./types";

type DiscussionCardProps = {
  discussion: DiscussionDetail;
  isOwner: boolean;
  onEdit: () => void;
  onReact: () => void;
};

export function DiscussionCard({
  discussion,
  isOwner,
  onEdit,
  onReact,
}: DiscussionCardProps) {
  return (
    <div className="rounded-xl bg-card p-6 shadow-sm ring-1 ring-border/50">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">
              {discussion.title}
            </h1>
            <Badge
              className={`shrink-0 rounded-lg px-2.5 py-0.5 text-xs ${CATEGORY_COLORS[discussion.category]}`}
            >
              {discussion.category}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <Link
              to="/profile/$profileId"
              params={{ profileId: discussion.authorId }}
              className="flex items-center gap-1.5 hover:text-foreground"
            >
              <User className="size-4" />
              {discussion.authorName ?? "Unknown"}
            </Link>
            <span>
              {formatDate(discussion.createdAt)} - {formatTime(discussion.createdAt)}
            </span>
            {isEdited(discussion.createdAt, discussion.updatedAt) && (
              <span className="text-muted-foreground/60">Edited</span>
            )}
            <span className="flex items-center gap-1">
              <Eye className="size-3.5" /> {discussion.viewCount}
            </span>
          </div>
        </div>
        {isOwner && (
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 rounded-lg"
            aria-label="Edit discussion"
            onClick={onEdit}
          >
            <Pencil className="size-3.5" />
          </Button>
        )}
      </div>

      <div className="mt-4 whitespace-pre-wrap text-base leading-relaxed text-foreground/90">
        {discussion.content}
      </div>

      <div className="mt-4 border-t border-border/50 pt-4">
        <button
          type="button"
          onClick={onReact}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            discussion.isReacted
              ? "bg-destructive/10 text-destructive"
              : "bg-secondary text-muted-foreground hover:bg-secondary/80"
          }`}
        >
          <Heart
            className={`size-4 ${discussion.isReacted ? "fill-current" : ""}`}
          />
          {discussion.reactionsCount}
        </button>
      </div>
    </div>
  );
}
