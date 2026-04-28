import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Heart, Pencil, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  getCommentGateMessage,
  getMissingProfileFieldLabels,
  type ActivityGate,
} from "@/lib/activity-gate";
import { formatDate, formatTime, isEdited } from "@/lib/utils";

import type { Comment } from "./types";

type CommentsSectionProps = {
  comments: Comment[];
  userId?: string;
  viewerActivityGate: ActivityGate | null;
  commentText: string;
  isAddingComment: boolean;
  onCommentTextChange: (value: string) => void;
  onAddComment: () => void;
  onDeleteComment: (commentId: string) => void;
  onReactComment: (commentId: string, wasReacted: boolean) => void;
  onEditComment: (commentId: string, content: string) => Promise<boolean>;
};

export function CommentsSection({
  comments,
  userId,
  viewerActivityGate,
  commentText,
  isAddingComment,
  onCommentTextChange,
  onAddComment,
  onDeleteComment,
  onReactComment,
  onEditComment,
}: CommentsSectionProps) {
  const [editCommentOpen, setEditCommentOpen] = useState(false);
  const [editCommentId, setEditCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState("");
  const [isEditCommentSubmitting, setIsEditCommentSubmitting] = useState(false);

  const missingFields = viewerActivityGate
    ? getMissingProfileFieldLabels(
        viewerActivityGate.profileCompletion.missingRequiredProfileFields,
      )
    : [];

  function openEditComment(comment: Comment) {
    setEditCommentId(comment.id);
    setEditCommentText(comment.content);
    setEditCommentOpen(true);
  }

  async function handleEditCommentSubmit() {
    // Keep edit validation local so the page only deals with the final saved content.
    if (
      !editCommentId ||
      !editCommentText.trim() ||
      editCommentText.length > 500
    ) {
      return;
    }

    setIsEditCommentSubmitting(true);
    try {
      const didSave = await onEditComment(editCommentId, editCommentText.trim());
      if (didSave) {
        setEditCommentOpen(false);
      }
    } finally {
      setIsEditCommentSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold">Comments ({comments.length})</h2>

      {comments.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No comments yet. Be the first to reply.
        </p>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => {
            const isCommentOwner = comment.authorId === userId;

            return (
              <div
                key={comment.id}
                className="rounded-xl bg-card p-4 shadow-sm ring-1 ring-border/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Link
                      to="/profile/$profileId"
                      params={{ profileId: comment.authorId }}
                      className="font-medium hover:underline"
                    >
                      {comment.authorName ?? "Unknown"}
                    </Link>
                    {comment.authorHasHelpfulMarker && (
                      <Badge className="rounded-full bg-lime-300/25 px-2 py-0.5 text-[10px] font-semibold text-lime-700 ring-1 ring-lime-400/40">
                        &#10022; Helpful
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {formatDate(comment.createdAt)} - {formatTime(comment.createdAt)}
                    </span>
                    {isEdited(comment.createdAt, comment.updatedAt) && (
                      <span className="text-xs text-muted-foreground/60">
                        Edited
                      </span>
                    )}
                  </div>
                  {isCommentOwner && (
                    <div className="flex gap-1">
                      <button
                        type="button"
                        aria-label="Edit comment"
                        onClick={() => openEditComment(comment)}
                        className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
                      >
                        <Pencil className="size-3" />
                      </button>
                      <button
                        type="button"
                        aria-label="Delete comment"
                        onClick={() => onDeleteComment(comment.id)}
                        className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  )}
                </div>
                <p className="mt-2 text-sm leading-relaxed">{comment.content}</p>
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => onReactComment(comment.id, comment.isReacted)}
                    className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                      comment.isReacted
                        ? "bg-destructive/10 text-destructive"
                        : "text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    <Heart
                      className={`size-3 ${comment.isReacted ? "fill-current" : ""}`}
                    />
                    {comment.reactionsCount}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-xl bg-card p-4 shadow-sm ring-1 ring-border/50">
        {viewerActivityGate &&
          !viewerActivityGate.permissions.canCommentOnDiscussions && (
            <div className="mb-4 rounded-lg bg-secondary p-3 text-sm text-muted-foreground">
              {/* Show the exact missing profile fields next to the composer so the gate is actionable. */}
              <p>{getCommentGateMessage(viewerActivityGate)}</p>
              {missingFields.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {missingFields.map((field) => (
                    <Badge key={field} variant="outline" className="rounded-lg">
                      {field}
                    </Badge>
                  ))}
                </div>
              )}
              <Link
                to="/profile"
                className="mt-3 inline-flex text-sm font-medium text-foreground hover:underline"
              >
                Go to profile
              </Link>
            </div>
          )}
        <Textarea
          placeholder="Write a comment..."
          value={commentText}
          onChange={(event) => onCommentTextChange(event.target.value)}
          rows={3}
          maxLength={500}
          className="rounded-lg bg-background"
          disabled={!viewerActivityGate?.permissions.canCommentOnDiscussions}
        />
        <div className="mt-2 flex items-center justify-between">
          <span
            className={`text-xs ${
              commentText.length > 450
                ? "text-destructive"
                : "text-muted-foreground"
            }`}
          >
            {commentText.length}/500
          </span>
          <Button
            size="sm"
            className="rounded-lg"
            onClick={onAddComment}
            disabled={
              !viewerActivityGate?.permissions.canCommentOnDiscussions ||
              !commentText.trim() ||
              commentText.length > 500 ||
              isAddingComment
            }
          >
            {isAddingComment ? "Posting..." : "Post Comment"}
          </Button>
        </div>
      </div>

      <Dialog open={editCommentOpen} onOpenChange={setEditCommentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Comment</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Textarea
              value={editCommentText}
              onChange={(event) => setEditCommentText(event.target.value)}
              rows={3}
              maxLength={500}
              className="rounded-lg bg-background"
            />
            <span
              className={`text-xs ${
                editCommentText.length > 450
                  ? "text-destructive"
                  : "text-muted-foreground"
              }`}
            >
              {editCommentText.length}/500
            </span>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-lg"
              onClick={() => setEditCommentOpen(false)}
              disabled={isEditCommentSubmitting}
            >
              Cancel
            </Button>
            <Button
              className="rounded-lg"
              onClick={handleEditCommentSubmit}
              disabled={
                !editCommentText.trim() ||
                editCommentText.length > 500 ||
                isEditCommentSubmitting
              }
            >
              {isEditCommentSubmitting ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
