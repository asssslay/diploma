import { Link, createFileRoute } from "@tanstack/react-router";
import { startTransition, useCallback, useEffect, useOptimistic, useState } from "react";
import {
  ArrowLeft,
  Eye,
  Heart,
  MessageSquare,
  Pencil,
  Trash2,
  User,
} from "lucide-react";
import { toast } from "sonner";
import type { InferResponseType } from "hono/client";
import { hc } from "hono/client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, formatTime, isEdited } from "@/lib/utils";
import { useAuth } from "@/context/auth";
import { getApiClient } from "@/lib/api";
import type { AppType } from "server";

type Client = ReturnType<typeof hc<AppType>>;
type DetailEndpoint = Client["api"]["discussions"][":id"]["$get"];
type DetailResponse = Extract<InferResponseType<DetailEndpoint>, { success: true }>;
type DiscussionDetail = DetailResponse["data"];
type Comment = DiscussionDetail["comments"][number];

type ServerComment = Omit<Comment, "reactionsCount" | "isReacted">;

export const Route = createFileRoute("/_student/discussion/$id")({
  component: DiscussionDetailPage,
});

const CATEGORY_COLORS: Record<string, string> = {
  general: "bg-secondary text-secondary-foreground",
  academic: "bg-accent text-accent-foreground",
  social: "bg-primary/10 text-primary",
  help: "bg-destructive/10 text-destructive",
  feedback: "bg-chart-1/20 text-foreground",
};

function DiscussionDetailPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const [discussion, setDiscussion] = useState<DiscussionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  type OptimisticAction =
    | { type: "react-discussion" }
    | { type: "react-comment"; commentId: string }
    | { type: "delete-comment"; commentId: string };

  const [optimistic, applyOptimistic] = useOptimistic(
    discussion,
    (current, action: OptimisticAction) => {
      if (!current) return current;
      switch (action.type) {
        case "react-discussion":
          return {
            ...current,
            isReacted: !current.isReacted,
            reactionsCount: current.reactionsCount + (current.isReacted ? -1 : 1),
          };
        case "react-comment":
          return {
            ...current,
            comments: current.comments.map((c) =>
              c.id === action.commentId
                ? { ...c, isReacted: !c.isReacted, reactionsCount: c.reactionsCount + (c.isReacted ? -1 : 1) }
                : c,
            ),
          };
        case "delete-comment":
          return {
            ...current,
            comments: current.comments.filter((c) => c.id !== action.commentId),
          };
      }
    },
  );

  // Comment form
  const [commentText, setCommentText] = useState("");
  const [isAddingComment, setIsAddingComment] = useState(false);

  // Edit discussion dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);

  // Edit comment dialog
  const [editCommentOpen, setEditCommentOpen] = useState(false);
  const [editCommentId, setEditCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState("");
  const [isEditCommentSubmitting, setIsEditCommentSubmitting] = useState(false);

  const fetchDiscussion = useCallback(async () => {
    setIsLoading(true);
    try {
      const api = await getApiClient();
      const res = await api.api.discussions[":id"].$get({ param: { id } });
      if (!res.ok) { toast.error("Failed to load discussion"); return; }
      const json = (await res.json()) as DetailResponse;
      setDiscussion(json.data);
    } catch { toast.error("Failed to load discussion"); }
    finally { setIsLoading(false); }
  }, [id]);

  useEffect(() => { fetchDiscussion(); }, [fetchDiscussion]);

  function handleReactDiscussion() {
    if (!discussion) return;
    const wasReacted = discussion.isReacted;
    startTransition(async () => {
      applyOptimistic({ type: "react-discussion" });
      try {
        const api = await getApiClient();
        if (wasReacted) {
          await api.api.discussions[":id"].react.$delete({ param: { id } });
        } else {
          await api.api.discussions[":id"].react.$post({ param: { id } });
        }
        setDiscussion((prev) =>
          prev
            ? { ...prev, isReacted: !wasReacted, reactionsCount: prev.reactionsCount + (wasReacted ? -1 : 1) }
            : prev,
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
      const res = await api.api.discussions[":id"].comments.$post({
        param: { id },
        json: { content: commentText.trim() },
      });
      if (!res.ok) { toast.error("Failed to add comment"); return; }
      const json = await res.json();
      const data = (json as { data: ServerComment }).data;
      const newComment: Comment = { ...data, reactionsCount: 0, isReacted: false };
      setDiscussion((prev) =>
        prev ? { ...prev, comments: [...prev.comments, newComment] } : prev,
      );
      setCommentText("");
    } catch { toast.error("Failed to add comment"); }
    finally { setIsAddingComment(false); }
  }

  function handleDeleteComment(commentId: string) {
    startTransition(async () => {
      applyOptimistic({ type: "delete-comment", commentId });
      try {
        const api = await getApiClient();
        const res = await api.api.discussions[":id"].comments[":commentId"].$delete({
          param: { id, commentId },
        });
        if (!res.ok) { toast.error("Failed to delete comment"); fetchDiscussion(); return; }
        setDiscussion((prev) =>
          prev ? { ...prev, comments: prev.comments.filter((c) => c.id !== commentId) } : prev,
        );
        toast.success("Comment deleted");
      } catch {
        toast.error("Failed to delete comment");
        fetchDiscussion();
      }
    });
  }

  function handleReactComment(commentId: string, wasReacted: boolean) {
    startTransition(async () => {
      applyOptimistic({ type: "react-comment", commentId });
      try {
        const api = await getApiClient();
        if (wasReacted) {
          await api.api.discussions[":id"].comments[":commentId"].react.$delete({ param: { id, commentId } });
        } else {
          await api.api.discussions[":id"].comments[":commentId"].react.$post({ param: { id, commentId } });
        }
        setDiscussion((prev) =>
          prev
            ? {
                ...prev,
                comments: prev.comments.map((c) =>
                  c.id === commentId
                    ? { ...c, isReacted: !wasReacted, reactionsCount: c.reactionsCount + (wasReacted ? -1 : 1) }
                    : c,
                ),
              }
            : prev,
        );
      } catch {
        toast.error("Failed to react");
      }
    });
  }

  const isOwner = discussion?.authorId === user?.id;

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
      const res = await api.api.discussions[":id"].$patch({
        param: { id },
        json: {
          title: editTitle,
          content: editContent,
          category: editCategory as "general" | "academic" | "social" | "help" | "feedback",
        },
      });
      if (!res.ok) { toast.error("Failed to update"); return; }
      setDiscussion((prev) =>
        prev
          ? {
              ...prev,
              title: editTitle,
              content: editContent,
              category: editCategory as typeof prev.category,
              updatedAt: new Date().toISOString(),
            }
          : prev,
      );
      toast.success("Discussion updated");
      setEditOpen(false);
    } catch { toast.error("Failed to update"); }
    finally { setIsEditSubmitting(false); }
  }

  function openEditComment(comment: Comment) {
    setEditCommentId(comment.id);
    setEditCommentText(comment.content);
    setEditCommentOpen(true);
  }

  async function handleEditComment() {
    if (!editCommentId || !editCommentText.trim() || editCommentText.length > 500) return;
    setIsEditCommentSubmitting(true);
    try {
      const api = await getApiClient();
      const res = await api.api.discussions[":id"].comments[":commentId"].$patch({
        param: { id, commentId: editCommentId },
        json: { content: editCommentText.trim() },
      });
      if (!res.ok) { toast.error("Failed to update comment"); return; }
      const json = await res.json();
      const updated = (json as { data: ServerComment }).data;
      setDiscussion((prev) =>
        prev
          ? {
              ...prev,
              comments: prev.comments.map((c) =>
                c.id === editCommentId
                  ? { ...c, content: updated.content, updatedAt: updated.updatedAt }
                  : c,
              ),
            }
          : prev,
      );
      toast.success("Comment updated");
      setEditCommentOpen(false);
    } catch { toast.error("Failed to update comment"); }
    finally { setIsEditCommentSubmitting(false); }
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

  if (!discussion || !optimistic) {
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

      {/* Discussion Card */}
      <div className="rounded-xl bg-card p-6 shadow-sm ring-1 ring-border/50">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{discussion.title}</h1>
              <Badge className={`shrink-0 rounded-lg text-xs px-2.5 py-0.5 ${CATEGORY_COLORS[discussion.category] ?? ``}`}>
                {discussion.category}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <Link to="/profile/$id" params={{ id: discussion.authorId }} className="flex items-center gap-1.5 hover:text-foreground">
                <User className="size-4" />
                {discussion.authorName ?? "Unknown"}
              </Link>
              <span>
                {formatDate(discussion.createdAt)} · {formatTime(discussion.createdAt)}
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
            <Button variant="ghost" size="sm" className="rounded-lg shrink-0" onClick={openEditDialog}>
              <Pencil className="size-3.5" />
            </Button>
          )}
        </div>

        <div className="mt-4 whitespace-pre-wrap text-base leading-relaxed text-foreground/90">
          {discussion.content}
        </div>

        <div className="mt-4 border-t border-border/50 pt-4">
          <button
            onClick={handleReactDiscussion}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              optimistic.isReacted
                ? "bg-destructive/10 text-destructive"
                : "bg-secondary text-muted-foreground hover:bg-secondary/80"
            }`}
          >
            <Heart className={`size-4 ${optimistic.isReacted ? `fill-current` : ``}`} />
            {optimistic.reactionsCount}
          </button>
        </div>
      </div>

      {/* Comments Section */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold">
          Comments ({optimistic.comments.length})
        </h2>

        {optimistic.comments.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No comments yet. Be the first to reply.
          </p>
        ) : (
          <div className="space-y-3">
            {optimistic.comments.map((comment) => {
              const isCommentOwner = comment.authorId === user?.id;
              return (
                <div key={comment.id} className="rounded-xl bg-card p-4 shadow-sm ring-1 ring-border/50">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Link to="/profile/$id" params={{ id: comment.authorId }} className="font-medium hover:underline">
                        {comment.authorName ?? "Unknown"}
                      </Link>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(comment.createdAt)} · {formatTime(comment.createdAt)}
                      </span>
                      {isEdited(comment.createdAt, comment.updatedAt) && (
                        <span className="text-xs text-muted-foreground/60">Edited</span>
                      )}
                    </div>
                    {isCommentOwner && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => openEditComment(comment)}
                          className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
                        >
                          <Pencil className="size-3" />
                        </button>
                        <button
                          onClick={() => handleDeleteComment(comment.id)}
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
                      onClick={() => handleReactComment(comment.id, comment.isReacted)}
                      className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                        comment.isReacted
                          ? "bg-destructive/10 text-destructive"
                          : "text-muted-foreground hover:bg-secondary"
                      }`}
                    >
                      <Heart className={`size-3 ${comment.isReacted ? `fill-current` : ``}`} />
                      {comment.reactionsCount}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Add Comment */}
        <div className="rounded-xl bg-card p-4 shadow-sm ring-1 ring-border/50">
          <Textarea
            placeholder="Write a comment..."
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            rows={3}
            maxLength={500}
            className="rounded-lg bg-background"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className={`text-xs ${commentText.length > 450 ? `text-destructive` : `text-muted-foreground`}`}>
              {commentText.length}/500
            </span>
            <Button
              size="sm"
              className="rounded-lg"
              onClick={handleAddComment}
              disabled={!commentText.trim() || commentText.length > 500 || isAddingComment}
            >
              {isAddingComment ? "Posting..." : "Post Comment"}
            </Button>
          </div>
        </div>
      </div>

      {/* Edit Discussion Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Discussion</DialogTitle>
            <DialogDescription>Update your discussion.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="rounded-lg bg-background" />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <div className="flex flex-wrap gap-2">
                {["general", "academic", "social", "help", "feedback"].map((c) => (
                  <button key={c} type="button" onClick={() => setEditCategory(c)}
                    className={`h-8 rounded-lg px-3 text-sm font-medium transition-colors ${editCategory === c ? `bg-primary text-primary-foreground` : `bg-secondary text-muted-foreground`}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Content</Label>
              <Textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={5} className="rounded-lg bg-background" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-lg" onClick={() => setEditOpen(false)} disabled={isEditSubmitting}>Cancel</Button>
            <Button className="rounded-lg" onClick={handleEditDiscussion} disabled={isEditSubmitting}>{isEditSubmitting ? "Saving..." : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Comment Dialog */}
      <Dialog open={editCommentOpen} onOpenChange={setEditCommentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Comment</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Textarea value={editCommentText} onChange={(e) => setEditCommentText(e.target.value)} rows={3} maxLength={500} className="rounded-lg bg-background" />
            <span className={`text-xs ${editCommentText.length > 450 ? `text-destructive` : `text-muted-foreground`}`}>
              {editCommentText.length}/500
            </span>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-lg" onClick={() => setEditCommentOpen(false)} disabled={isEditCommentSubmitting}>Cancel</Button>
            <Button className="rounded-lg" onClick={handleEditComment} disabled={!editCommentText.trim() || editCommentText.length > 500 || isEditCommentSubmitting}>
              {isEditCommentSubmitting ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
