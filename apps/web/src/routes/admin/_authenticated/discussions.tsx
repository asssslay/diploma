import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils";
import { getApiClient } from "@/lib/api";
import type { AppType } from "server";

type Client = ReturnType<typeof hc<AppType>>;
type ListEndpoint = Client["api"]["admin"]["discussions"]["$get"];
type ListResponse = Extract<InferResponseType<ListEndpoint>, { success: true }>;
type DiscussionItem = ListResponse["data"][number];

export const Route = createFileRoute("/admin/_authenticated/discussions")({
  component: AdminDiscussionsPage,
});

function AdminDiscussionsPage() {
  const [discussions, setDiscussions] = useState<DiscussionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [isLoading, setIsLoading] = useState(true);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
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

  function openDeleteDialog(id: string) {
    setDeleteTargetId(id);
    setDeleteDialogOpen(true);
  }

  async function handleDelete() {
    if (!deleteTargetId) return;
    setIsDeleting(true);
    try {
      const api = await getApiClient();
      const res = await api.api.admin.discussions[":id"].$delete({
        param: { id: deleteTargetId },
      });
      if (!res.ok) { toast.error("Failed to delete discussion"); return; }
      toast.success("Discussion deleted");
      setDeleteDialogOpen(false);
      setDeleteTargetId(null);
      fetchDiscussions();
    } catch { toast.error("Failed to delete discussion"); }
    finally { setIsDeleting(false); }
  }

  const tableHeadClass = "px-4 py-3 text-left text-xs font-semibold text-muted-foreground";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Discussion Moderation</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage student discussions.</p>
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
                  <td className="px-4 py-3"><Skeleton className="ml-auto h-4 w-8" /></td>
                </tr>
              ))
            ) : discussions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center text-sm text-muted-foreground">
                  No discussions yet.
                </td>
              </tr>
            ) : (
              discussions.map((d) => (
                <tr key={d.id} className="border-b border-border/30 last:border-0">
                  <td className="px-4 py-3 font-medium">{d.title}</td>
                  <td className="px-4 py-3 text-muted-foreground">{d.authorName ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="rounded-lg">{d.category}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{d.commentCount}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(d.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => openDeleteDialog(d.id)}
                      title="Delete"
                      className="ml-auto flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
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

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Discussion</DialogTitle>
            <DialogDescription>
              Are you sure? This will permanently delete the discussion and all its comments. This action cannot be undone.
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
