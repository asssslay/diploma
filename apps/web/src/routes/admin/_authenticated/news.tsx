import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { formatDate, isEdited } from "@/lib/utils";
import { toast } from "sonner";
import { z } from "zod";
import type { InferResponseType } from "hono/client";
import { hc } from "hono/client";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
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
import { getApiClient } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { env } from "@my-better-t-app/env/web";
import type { AppType } from "server";

type Client = ReturnType<typeof hc<AppType>>;
type ListEndpoint = Client["api"]["admin"]["news"]["$get"];
type SuccessResponse = Extract<
  InferResponseType<ListEndpoint>,
  { success: true }
>;
type NewsPost = SuccessResponse["data"][number];

export const Route = createFileRoute("/admin/_authenticated/news")({
  component: NewsPage,
});

const newsSchema = z.object({
  title: z.string().min(1, { message: "Title is required" }).max(200, { message: "Title must be under 200 characters" }),
  content: z.string().min(1, { message: "Content is required" }),
});

type FieldErrors = Partial<Record<keyof z.infer<typeof newsSchema>, string>>;

function NewsPage() {
  const [newsPosts, setNewsPosts] = useState<NewsPost[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [isLoading, setIsLoading] = useState(true);

  // Create/Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const totalPages = Math.ceil(total / pageSize);
  const isEditing = editingId !== null;

  const fetchNews = useCallback(async () => {
    setIsLoading(true);
    try {
      const api = await getApiClient();
      const res = await api.api.admin.news.$get({
        query: { page: String(page), pageSize: String(pageSize) },
      });
      if (!res.ok) { toast.error("Failed to load news"); return; }
      const json = (await res.json()) as SuccessResponse;
      setNewsPosts(json.data);
      setTotal(json.total);
    } catch { toast.error("Failed to load news"); }
    finally { setIsLoading(false); }
  }, [page, pageSize]);

  useEffect(() => { fetchNews(); }, [fetchNews]);

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setImageFile(file);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(file ? URL.createObjectURL(file) : null);
    if (file) setExistingImageUrl(null);
  }

  function resetForm() {
    setEditingId(null);
    setTitle("");
    setContent("");
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    setExistingImageUrl(null);
    setErrors({});
  }

  function openCreateDialog() {
    resetForm();
    setDialogOpen(true);
  }

  function openEditDialog(post: NewsPost) {
    resetForm();
    setEditingId(post.id);
    setTitle(post.title);
    setContent(post.content);
    setExistingImageUrl(post.imageUrl);
    setDialogOpen(true);
  }

  function openDeleteDialog(id: string) {
    setDeleteTargetId(id);
    setDeleteDialogOpen(true);
  }

  async function handleSubmit() {
    const result = newsSchema.safeParse({ title, content });
    if (!result.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof FieldErrors;
        if (!fieldErrors[field]) fieldErrors[field] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      let imageUrl: string | undefined | null = existingImageUrl;

      if (imageFile) {
        const { data: { session } } = await supabase.auth.getSession();
        const formData = new FormData();
        formData.append("image", imageFile);
        const uploadRes = await fetch(
          `${env.VITE_SERVER_URL}/api/admin/news/upload-image`,
          { method: "POST", headers: { Authorization: `Bearer ${session?.access_token}` }, body: formData },
        );
        if (!uploadRes.ok) { toast.error("Failed to upload image"); return; }
        const uploadJson = await uploadRes.json();
        imageUrl = uploadJson.data.imageUrl;
      }

      const api = await getApiClient();

      if (isEditing) {
        const res = await api.api.admin.news[":id"].$patch({
          param: { id: editingId },
          json: {
            title: result.data.title,
            content: result.data.content,
            imageUrl: imageUrl ?? null,
          },
        });
        if (!res.ok) { toast.error("Failed to update news post"); return; }
        toast.success("News post updated");
      } else {
        const res = await api.api.admin.news.$post({
          json: {
            title: result.data.title,
            content: result.data.content,
            ...(imageUrl ? { imageUrl } : {}),
          },
        });
        if (!res.ok) { toast.error("Failed to create news post"); return; }
        toast.success("News post created");
      }

      setDialogOpen(false);
      resetForm();
      fetchNews();
    } catch {
      toast.error(isEditing ? "Failed to update news post" : "Failed to create news post");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTargetId) return;
    setIsDeleting(true);
    try {
      const api = await getApiClient();
      const res = await api.api.admin.news[":id"].$delete({
        param: { id: deleteTargetId },
      });
      if (!res.ok) { toast.error("Failed to delete news post"); return; }
      toast.success("News post deleted");
      setDeleteDialogOpen(false);
      setDeleteTargetId(null);
      fetchNews();
    } catch {
      toast.error("Failed to delete news post");
    } finally {
      setIsDeleting(false);
    }
  }

  const currentPreview = imagePreview ?? existingImageUrl;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">News Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create and manage news articles.</p>
        </div>
        <Button className="rounded-lg" onClick={openCreateDialog}>
          <Plus className="mr-2 size-4" />
          Create News
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl bg-card shadow-sm ring-1 ring-border/50">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 bg-secondary/50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Title</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Author</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Published</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Views</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border/30">
                  <td className="px-4 py-3"><Skeleton className="h-4 w-48" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-12" /></td>
                  <td className="px-4 py-3"><Skeleton className="ml-auto h-4 w-16" /></td>
                </tr>
              ))
            ) : newsPosts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-16 text-center text-sm text-muted-foreground">
                  No news posts yet. Create your first one.
                </td>
              </tr>
            ) : (
              newsPosts.map((post) => (
                <tr key={post.id} className="border-b border-border/30 last:border-0">
                  <td className="px-4 py-3 font-medium">{post.title}</td>
                  <td className="px-4 py-3 text-muted-foreground">{post.authorName ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDate(post.publishedAt)}
                    {post.updatedAt && isEdited(post.createdAt, post.updatedAt) && (
                      <span className="text-muted-foreground/50"> · Edited</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{post.viewCount}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEditDialog(post)}
                        title="Edit"
                        className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        onClick={() => openDeleteDialog(post.id)}
                        title="Delete"
                        className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
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

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit News Post" : "Create News Post"}</DialogTitle>
            <DialogDescription>
              {isEditing ? "Update the news article details." : "Write a new news article. It will be published immediately."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="news-title">Title</Label>
              <Input id="news-title" placeholder="Enter news title..." value={title} onChange={(e) => setTitle(e.target.value)} className="rounded-lg bg-background" />
              {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="news-content">Content</Label>
              <Textarea id="news-content" placeholder="Write your article..." value={content} onChange={(e) => setContent(e.target.value)} rows={6} className="rounded-lg bg-background" />
              {errors.content && <p className="text-xs text-destructive">{errors.content}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="news-image">Image (optional)</Label>
              <Input id="news-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageChange} className="rounded-lg bg-background" />
              {currentPreview && (
                <div className="relative mt-2">
                  <img src={currentPreview} alt="Preview" className="max-h-48 rounded-xl object-cover" />
                  <button
                    type="button"
                    onClick={() => { setImageFile(null); if (imagePreview) URL.revokeObjectURL(imagePreview); setImagePreview(null); setExistingImageUrl(null); }}
                    className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-foreground/70 text-background transition-colors hover:bg-foreground"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" className="rounded-lg" onClick={() => setDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
            <Button className="rounded-lg" onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (isEditing ? "Saving..." : "Creating...") : (isEditing ? "Save Changes" : "Create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete News Post"
        description="Are you sure you want to delete this news post? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        isPending={isDeleting}
      />
    </div>
  );
}
