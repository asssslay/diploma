import { Link, createFileRoute } from "@tanstack/react-router";
import {
  startTransition,
  useCallback,
  useEffect,
  useOptimistic,
  useState,
} from "react";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/context/auth";
import { getApiClient, readApiErrorResponse } from "@/lib/api";
import type { ActivityGate } from "@/lib/activity-gate";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { CommentsSection } from "./discussion-detail/comments-section";
import { DiscussionCard } from "./discussion-detail/discussion-card";
import {
  appendComment,
  applyHelpfulMarkerToAuthor,
  applyOptimisticDiscussionAction,
  removeComment,
  toggleCommentReaction,
  toggleDiscussionReaction,
  updateCommentContent,
  updateDiscussionContent,
} from "./discussion-detail/discussion-state";
import { EditDiscussionDialog } from "./discussion-detail/edit-discussion-dialog";
import {
  HELPFUL_REACTION_THRESHOLD,
  type Comment,
  type CreatedComment,
  type DetailResponse,
  type DiscussionCategory,
  type DiscussionDetail,
  type HelpfulMarkerReactionResult,
  type ServerComment,
} from "./discussion-detail/types";

export const Route = createFileRoute("/_student/discussions_/$discussionId")({
  component: DiscussionDetailPage,
});

function DiscussionDetailPage() {
  const { discussionId } = Route.useParams();
  const { user } = useAuth();
  const [discussion, setDiscussion] = useState<DiscussionDetail | null>(null);
  const [viewerActivityGate, setViewerActivityGate] =
    useState<ActivityGate | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [commentText, setCommentText] = useState("");
  const [isAddingComment, setIsAddingComment] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editCategory, setEditCategory] =
    useState<DiscussionCategory>("general");
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);

  const [optimistic, applyOptimistic] = useOptimistic(
    discussion,
    applyOptimisticDiscussionAction,
  );

  const fetchDiscussion = useCallback(async () => {
    setIsLoading(true);
    try {
      const api = await getApiClient();
      const response = await api.api.discussions[":id"].$get({
        param: { id: discussionId },
      });
      if (!response.ok) {
        toast.error("Failed to load discussion");
        return;
      }

      const json = (await response.json()) as DetailResponse;
      setDiscussion(json.data);
      setViewerActivityGate(json.viewerActivityGate);
    } catch {
      toast.error("Failed to load discussion");
    } finally {
      setIsLoading(false);
    }
  }, [discussionId]);

  useEffect(() => {
    fetchDiscussion();
  }, [fetchDiscussion]);

  function handleReactDiscussion() {
    if (!discussion) return;

    const wasReacted = discussion.isReacted;
    startTransition(async () => {
      applyOptimistic({ type: "react-discussion" });
      try {
        const api = await getApiClient();
        if (wasReacted) {
          await api.api.discussions[":id"].react.$delete({
            param: { id: discussionId },
          });
        } else {
          await api.api.discussions[":id"].react.$post({
            param: { id: discussionId },
          });
        }

        setDiscussion((prev) =>
          prev ? toggleDiscussionReaction(prev) : prev,
        );
      } catch {
        toast.error("Failed to react");
      }
    });
  }

  async function handleAddComment() {
    if (!commentText.trim() || commentText.length > 500) return;

    setIsAddingComment(true);
    try {
      const api = await getApiClient();
      const response = await api.api.discussions[":id"].comments.$post({
        param: { id: discussionId },
        json: { content: commentText.trim() },
      });
      if (!response.ok) {
        const apiError = await readApiErrorResponse(response);
        if (apiError?.activityGate) {
          setViewerActivityGate(apiError.activityGate);
        }
        toast.error(apiError?.error ?? "Failed to add comment");
        return;
      }

      const json = await response.json();
      const data = (json as { data: CreatedComment }).data;
      const newComment: Comment = {
        ...data,
        authorHasHelpfulMarker: data.authorHasHelpfulMarker,
        reactionsCount: 0,
        isReacted: false,
      };

      setDiscussion((prev) => (prev ? appendComment(prev, newComment) : prev));
      setViewerActivityGate((prev) =>
        prev
          ? {
              ...prev,
              commentsPosted: prev.commentsPosted + 1,
              permissions: {
                ...prev.permissions,
                canCreateDiscussions: true,
              },
            }
          : prev,
      );
      setCommentText("");
    } catch {
      toast.error("Failed to add comment");
    } finally {
      setIsAddingComment(false);
    }
  }

  function handleDeleteComment(commentId: string) {
    startTransition(async () => {
      applyOptimistic({ type: "delete-comment", commentId });
      try {
        const api = await getApiClient();
        const response = await api.api.discussions[":id"].comments[
          ":commentId"
        ].$delete({
          param: { id: discussionId, commentId },
        });
        if (!response.ok) {
          toast.error("Failed to delete comment");
          fetchDiscussion();
          return;
        }

        setDiscussion((prev) => (prev ? removeComment(prev, commentId) : prev));
        toast.success("Comment deleted");
      } catch {
        toast.error("Failed to delete comment");
        fetchDiscussion();
      }
    });
  }

  function handleReactComment(commentId: string, wasReacted: boolean) {
    const targetComment = discussion?.comments.find(
      (comment) => comment.id === commentId,
    );
    const shouldUnlockHelpfulMarker =
      !wasReacted &&
      !!targetComment &&
      !targetComment.authorHasHelpfulMarker &&
      targetComment.reactionsCount >= HELPFUL_REACTION_THRESHOLD;

    startTransition(async () => {
      applyOptimistic({
        type: "react-comment",
        commentId,
        helpfulAuthorId: shouldUnlockHelpfulMarker
          ? targetComment.authorId
          : undefined,
        authorHasHelpfulMarker: shouldUnlockHelpfulMarker ? true : undefined,
      });

      try {
        const api = await getApiClient();
        const response = wasReacted
          ? await api.api.discussions[":id"].comments[":commentId"].react.$delete(
              { param: { id: discussionId, commentId } },
            )
          : await api.api.discussions[":id"].comments[":commentId"].react.$post(
              { param: { id: discussionId, commentId } },
            );

        if (!response.ok) {
          toast.error("Failed to react");
          return;
        }

        const json =
          (await response.json()) as HelpfulMarkerReactionResult;
        const marker = json.data.helpfulMarker;

        setDiscussion((prev) => {
          if (!prev) return prev;

          const updatedDiscussion = toggleCommentReaction(
            prev,
            commentId,
            wasReacted,
          );

          return marker
            ? applyHelpfulMarkerToAuthor(
                updatedDiscussion,
                marker.authorId,
                marker.authorHasHelpfulMarker,
              )
            : updatedDiscussion;
        });

        if (!wasReacted && marker?.achievementEarned) {
          const isOwnAchievement = marker.authorId === user?.id;
          toast.success(
            isOwnAchievement
              ? "Achievement unlocked: Helpful contributor"
              : "Helpful contributor unlocked",
            {
              description: isOwnAchievement
                ? "One of your comments passed 10 positive reactions."
                : `${marker.authorName ?? "A student"} earned the Helpful badge.`,
            },
          );
        }
      } catch {
        toast.error("Failed to react");
      }
    });
  }

  const isOwner = discussion?.authorId === user?.id;
  const displayedDiscussion = optimistic ?? discussion;

  function openEditDialog() {
    if (!discussion) return;

    setEditTitle(discussion.title);
    setEditContent(discussion.content);
    setEditCategory(discussion.category);
    setEditOpen(true);
  }

  async function handleEditDiscussion() {
    setIsEditSubmitting(true);
    try {
      const api = await getApiClient();
      const response = await api.api.discussions[":id"].$patch({
        param: { id: discussionId },
        json: {
          title: editTitle,
          content: editContent,
          category: editCategory,
        },
      });
      if (!response.ok) {
        toast.error("Failed to update");
        return;
      }

      setDiscussion((prev) =>
        prev
          ? updateDiscussionContent(prev, {
              title: editTitle,
              content: editContent,
              category: editCategory,
              updatedAt: new Date().toISOString(),
            })
          : prev,
      );
      toast.success("Discussion updated");
      setEditOpen(false);
    } catch {
      toast.error("Failed to update");
    } finally {
      setIsEditSubmitting(false);
    }
  }

  async function handleEditComment(commentId: string, content: string) {
    try {
      const api = await getApiClient();
      const response = await api.api.discussions[":id"].comments[
        ":commentId"
      ].$patch({
        param: { id: discussionId, commentId },
        json: { content },
      });
      if (!response.ok) {
        toast.error("Failed to update comment");
        return false;
      }

      const json = await response.json();
      const updated = (json as { data: ServerComment }).data;
      setDiscussion((prev) =>
        prev
          ? updateCommentContent(prev, commentId, {
              content: updated.content,
              updatedAt: updated.updatedAt,
            })
          : prev,
      );
      toast.success("Comment updated");
      return true;
    } catch {
      toast.error("Failed to update comment");
      return false;
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
        <Skeleton className="h-8 w-16 rounded-lg" />
        <Skeleton className="h-8 w-3/4 rounded-lg" />
        <div className="flex gap-4">
          <Skeleton className="h-4 w-24 rounded-lg" />
          <Skeleton className="h-4 w-24 rounded-lg" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-full rounded-lg" />
          <Skeleton className="h-4 w-full rounded-lg" />
          <Skeleton className="h-4 w-2/3 rounded-lg" />
        </div>
      </div>
    );
  }

  if (!discussion || !displayedDiscussion) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-8">
        <Link to="/discussions">
          <Button variant="ghost" size="sm" className="rounded-lg">
            <ArrowLeft className="mr-2 size-4" /> Back
          </Button>
        </Link>
        <div className="flex flex-col items-center gap-3 py-20">
          <div className="flex size-14 items-center justify-center rounded-full bg-secondary">
            <MessageSquare className="size-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">Discussion not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
      <Link to="/discussions">
        <Button variant="ghost" size="sm" className="rounded-lg">
          <ArrowLeft className="mr-2 size-4" /> Back
        </Button>
      </Link>

      <DiscussionCard
        discussion={displayedDiscussion}
        isOwner={!!isOwner}
        onEdit={openEditDialog}
        onReact={handleReactDiscussion}
      />

      <CommentsSection
        comments={displayedDiscussion.comments}
        userId={user?.id}
        viewerActivityGate={viewerActivityGate}
        commentText={commentText}
        isAddingComment={isAddingComment}
        onCommentTextChange={setCommentText}
        onAddComment={handleAddComment}
        onDeleteComment={handleDeleteComment}
        onReactComment={handleReactComment}
        onEditComment={handleEditComment}
      />

      <EditDiscussionDialog
        open={editOpen}
        title={editTitle}
        content={editContent}
        category={editCategory}
        isSubmitting={isEditSubmitting}
        onOpenChange={setEditOpen}
        onTitleChange={setEditTitle}
        onContentChange={setEditContent}
        onCategoryChange={setEditCategory}
        onSave={handleEditDiscussion}
      />
    </div>
  );
}
