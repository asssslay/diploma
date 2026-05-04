import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Eye, Trash2 } from "lucide-react";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatTime, isEdited } from "@/lib/utils";
import { getApiClient } from "@/lib/api";
import type { AppType } from "server";

type Client = ReturnType<typeof hc<AppType>>;
type ListEndpoint = Client["api"]["admin"]["discussions"]["$get"];
type ListResponse = Extract<InferResponseType<ListEndpoint>, { success: true }>;
type DiscussionItem = ListResponse["data"][number];

type DetailEndpoint = Client["api"]["admin"]["discussions"][":id"]["$get"];
type DetailResponse = Extract<InferResponseType<DetailEndpoint>, { success: true }>;
type DiscussionDetail = DetailResponse["data"];
type AdminComment = DiscussionDetail["comments"][number];

export const Route = createFileRoute("/admin/_authenticated/discussions")({
  component: AdminDiscussionsPage,
});

function AdminDiscussionsPage() {
  const [discussions, setDiscussions] = useState<DiscussionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [isLoading, setIsLoading] = useState(true);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedDiscussion, setSelectedDiscussion] = useState<DiscussionDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleteType, setDeleteType] = useState<"discussion" | "comment">("discussion");
  const [deleteCommentId, setDeleteCommentId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const totalPages = Math.ceil(total / pageSize);

  const fetchDiscussions = useCallback(async () => {
    setIsLoading(true);
    try {
      const api = await getApiClient();
      const res = await api.api.admin.discussions.$get({
        query: { page: String(page), pageSize: String(pageSize) },
      });
      if (!res.ok) { toast.error("Failed to load discussions"); return; }
      const json = (await res.json()) as ListResponse;
      setDiscussions(json.data);
      setTotal(json.total);
    } catch { toast.error("Failed to load discussions"); }
    finally { setIsLoading(false); }
  }, [page, pageSize]);

  useEffect(() => { fetchDiscussions(); }, [fetchDiscussions]);

  async function openDetail(id: string) {
    setSheetOpen(true);
    setIsLoadingDetail(true);
    setSelectedDiscussion(null);
    try {
      const api = await getApiClient();
      const res = await api.api.admin.discussions[":id"].$get({ param: { id } });
      if (!res.ok) { toast.error("Failed to load discussion"); setSheetOpen(false); return; }
      const json = (await res.json()) as DetailResponse;
      setSelectedDiscussion(json.data);
    } catch { toast.error("Failed to load discussion"); setSheetOpen(false); }
    finally { setIsLoadingDetail(false); }
  }

  function openDeleteDiscussion(id: string) {
    setDeleteTargetId(id);
    setDeleteType("discussion");
    setDeleteDialogOpen(true);
  }

  function openDeleteComment(discussionId: string, commentId: string) {
    setDeleteTargetId(discussionId);
    setDeleteCommentId(commentId);
    setDeleteType("comment");
    setDeleteDialogOpen(true);
  }

  async function handleDelete() {
    if (!deleteTargetId) return;
    setIsDeleting(true);
    try {
      const api = await getApiClient();
      if (deleteType === "discussion") {
        const res = await api.api.admin.discussions[":id"].$delete({ param: { id: deleteTargetId } });
        if (!res.ok) { toast.error("Failed to delete discussion"); return; }
        toast.success("Discussion deleted");
        if (selectedDiscussion?.id === deleteTargetId) {
          setSelectedDiscussion(null);
          setSheetOpen(false);
        }
        fetchDiscussions();
      } else if (deleteCommentId) {
        const res = await api.api.admin.discussions[":id"].comments[":commentId"].$delete({
          param: { id: deleteTargetId, commentId: deleteCommentId },
        });
        if (!res.ok) { toast.error("Failed to delete comment"); return; }
        toast.success("Comment deleted");
        setSelectedDiscussion((prev) =>
          prev ? { ...prev, comments: prev.comments.filter((c) => c.id !== deleteCommentId), commentCount: prev.commentCount - 1 } : prev,
        );
      }
      setDeleteDialogOpen(false);
      setDeleteTargetId(null);
      setDeleteCommentId(null);
    } catch { toast.error("Failed to delete"); }
    finally { setIsDeleting(false); }
  }

  const tableHeadClass = "px-4 py-3 text-left text-xs font-semibold text-muted-foreground";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Discussion Moderation</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage student discussions and comments.</p>
      </div>

      <div className="overflow-hidden rounded-xl bg-card shadow-sm ring-1 ring-border/50">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 bg-secondary/50">
              <th className={tableHeadClass}>Title</th>
              <th className={tableHeadClass}>Author</th>
              <th className={tableHeadClass}>Category</th>
              <th className={tableHeadClass}>Comments</th>
              <th className={tableHeadClass}>Date</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border/30">
                  <td className="px-4 py-3"><Skeleton className="h-4 w-40" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-8" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                  <td className="px-4 py-3"><Skeleton className="ml-auto h-4 w-16" /></td>
                </tr>
              ))
            ) : discussions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center text-sm text-muted-foreground">No discussions yet.</td>
              </tr>
            ) : (
              discussions.map((d) => (
                <tr
                  key={d.id}
                  className="border-b border-border/30 last:border-0 cursor-pointer transition-colors hover:bg-secondary/30"
                  onClick={() => openDetail(d.id)}
                >
                  <td className="px-4 py-3 font-medium">{d.title}</td>
                  <td className="px-4 py-3 text-muted-foreground">{d.authorName ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="rounded-lg">{d.category}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{d.commentCount}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(d.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      onClick={(e) => { e.stopPropagation(); openDeleteDiscussion(d.id); }}
                      variant="ghost"
                      size="icon-sm"
                      title="Delete"
                      className="ml-auto text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!isLoading && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="rounded-lg" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" className="rounded-lg" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      {/* Detail Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
          {isLoadingDetail ? (
            <div className="space-y-4 p-4">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : selectedDiscussion ? (
            <div className="flex h-full flex-col">
              <SheetHeader>
                <div className="flex items-center gap-2">
                  <SheetTitle className="text-base">{selectedDiscussion.title}</SheetTitle>
                  <Badge variant="outline" className="rounded-lg text-[10px]">{selectedDiscussion.category}</Badge>
                </div>
                <SheetDescription>
                  {selectedDiscussion.authorName ?? "Unknown"} · {formatDate(selectedDiscussion.createdAt)} · {formatTime(selectedDiscussion.createdAt)}
                  {isEdited(selectedDiscussion.createdAt, selectedDiscussion.updatedAt) && " · Edited"}
                </SheetDescription>
                <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Eye className="size-3" /> {selectedDiscussion.viewCount} views</span>
                  <span>{selectedDiscussion.commentCount} comments</span>
                </div>
              </SheetHeader>

              <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-4">
                <div className="whitespace-pre-wrap rounded-lg bg-secondary/50 p-4 text-sm leading-relaxed">
                  {selectedDiscussion.content}
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground">Comments ({selectedDiscussion.commentCount})</h3>
                  {selectedDiscussion.comments.length === 0 ? (
                    <p className="mt-3 text-xs text-muted-foreground">No comments.</p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {selectedDiscussion.comments.map((comment: AdminComment) => (
                        <div key={comment.id} className="flex items-start gap-3 rounded-lg bg-secondary/30 p-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium">{comment.authorName ?? "Unknown"}</span>
                              <span className="text-[10px] text-muted-foreground">
                                {formatDate(comment.createdAt)} · {formatTime(comment.createdAt)}
                              </span>
                              {isEdited(comment.createdAt, comment.updatedAt) && (
                                <span className="text-[10px] text-muted-foreground/60">Edited</span>
                              )}
                            </div>
                            <p className="mt-1 text-xs leading-relaxed text-foreground/80">{comment.content}</p>
                          </div>
                          <Button
                            onClick={() => openDeleteComment(selectedDiscussion.id, comment.id)}
                            variant="ghost"
                            size="icon-xs"
                            title="Delete comment"
                            className="shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full rounded-lg"
                    onClick={() => openDeleteDiscussion(selectedDiscussion.id)}
                  >
                    <Trash2 className="mr-2 size-3.5" />
                    Delete Discussion
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleteType === "discussion" ? "Discussion" : "Comment"}</DialogTitle>
            <DialogDescription>
              {deleteType === "discussion"
                ? "This will permanently delete the discussion and all its comments. This action cannot be undone."
                : "This will permanently delete this comment. This action cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="rounded-lg" onClick={() => setDeleteDialogOpen(false)} disabled={isDeleting}>Cancel</Button>
            <Button variant="destructive" className="rounded-lg" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
