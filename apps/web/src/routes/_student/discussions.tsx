import { Link, createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownAZ,
  ArrowRight,
  ArrowUpAZ,
  Eye,
  Heart,
  MessageSquare,
  Plus,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
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
import { formatDate } from "@/lib/utils";
import { getApiClient } from "@/lib/api";
import type { AppType } from "server";

type Client = ReturnType<typeof hc<AppType>>;
type ListEndpoint = Client["api"]["discussions"]["$get"];
type ListResponse = Extract<InferResponseType<ListEndpoint>, { success: true }>;
type Discussion = ListResponse["data"][number];

export const Route = createFileRoute("/_student/discussions")({
  component: DiscussionsPage,
});

type CategoryFilter =
  | undefined
  | "general"
  | "academic"
  | "social"
  | "help"
  | "feedback";

const CATEGORIES: { value: CategoryFilter; label: string }[] = [
  { value: undefined, label: "All" },
  { value: "general", label: "General" },
  { value: "academic", label: "Academic" },
  { value: "social", label: "Social" },
  { value: "help", label: "Help" },
  { value: "feedback", label: "Feedback" },
];

const CATEGORY_COLORS: Record<string, string> = {
  general: "bg-secondary text-secondary-foreground",
  academic: "bg-accent text-accent-foreground",
  social: "bg-primary/10 text-primary",
  help: "bg-destructive/10 text-destructive",
  feedback: "bg-chart-1/20 text-foreground",
};

const createSchema = z.object({
  title: z.string().min(1, { message: "Title is required" }).max(200),
  content: z.string().min(1, { message: "Content is required" }),
  category: z.enum(["general", "academic", "social", "help", "feedback"], {
    message: "Category is required",
  }),
});

type FieldErrors = Partial<Record<keyof z.infer<typeof createSchema>, string>>;

function DiscussionsPage() {
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [isLoading, setIsLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>(undefined);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [sortAsc, setSortAsc] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<string>("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalPages = Math.ceil(total / pageSize);

  const fetchDiscussions = useCallback(async () => {
    setIsLoading(true);
    try {
      const api = await getApiClient();
      const res = await api.api.discussions.$get({
        query: {
          page: String(page),
          pageSize: String(pageSize),
          ...(categoryFilter ? { category: categoryFilter } : {}),
        },
      });
      if (!res.ok) { toast.error("Failed to load discussions"); return; }
      const json = (await res.json()) as ListResponse;
      setDiscussions(json.data);
      setTotal(json.total);
    } catch { toast.error("Failed to load discussions"); }
    finally { setIsLoading(false); }
  }, [page, pageSize, categoryFilter]);

  useEffect(() => { fetchDiscussions(); }, [fetchDiscussions]);

  const filtered = useMemo(() => {
    let result = [...discussions];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((d) => d.title.toLowerCase().includes(q));
    }
    result.sort((a, b) => {
      const da = new Date(a.createdAt).getTime();
      const db = new Date(b.createdAt).getTime();
      return sortAsc ? da - db : db - da;
    });
    return result;
  }, [discussions, search, sortAsc]);

  function resetForm() {
    setTitle(""); setContent(""); setCategory(""); setErrors({});
  }

  async function handleCreate() {
    const result = createSchema.safeParse({ title, content, category });
    if (!result.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof FieldErrors;
        if (!fieldErrors[field]) fieldErrors[field] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setErrors({}); setIsSubmitting(true);
    try {
      const api = await getApiClient();
      const res = await api.api.discussions.$post({
        json: {
          title: result.data.title,
          content: result.data.content,
          category: result.data.category,
        },
      });
      if (!res.ok) { toast.error("Failed to create discussion"); return; }
      toast.success("Discussion created");
      setCreateOpen(false);
      resetForm();
      fetchDiscussions();
    } catch { toast.error("Failed to create discussion"); }
    finally { setIsSubmitting(false); }
  }

  return (
    <div className="space-y-6 px-8 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Discussions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Join conversations with the university community.
          </p>
        </div>
        <Button className="rounded-lg" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 size-4" />
          New Discussion
        </Button>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          {searchOpen && (
            <Input
              placeholder="Search discussions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 flex-1 rounded-lg bg-card shadow-sm ring-1 ring-border/50"
              autoFocus
            />
          )}
          <button
            onClick={() => { setSearchOpen((v) => !v); if (searchOpen) setSearch(""); }}
            className="flex size-9 items-center justify-center rounded-lg bg-card shadow-sm ring-1 ring-border/50 transition-colors hover:bg-secondary"
          >
            <Search className="size-4 text-muted-foreground" />
          </button>
          <button
            onClick={() => setSortAsc((v) => !v)}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-card px-3 text-sm font-medium shadow-sm ring-1 ring-border/50 transition-colors hover:bg-secondary"
          >
            {sortAsc ? <ArrowUpAZ className="size-4" /> : <ArrowDownAZ className="size-4" />}
            {sortAsc ? "Oldest" : "Newest"}
          </button>
        </div>

        <div className="flex gap-2">
          {CATEGORIES.map(({ value, label }) => (
            <button
              key={label}
              onClick={() => { setCategoryFilter(value); setPage(1); }}
              className={`h-8 rounded-lg px-4 text-sm font-medium transition-colors ${
                categoryFilter === value
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground ring-1 ring-border/50 hover:bg-secondary"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-5 rounded-xl bg-card px-5 py-4 shadow-sm ring-1 ring-border/50">
              <Skeleton className="size-11 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-3.5 w-full" />
              </div>
              <Skeleton className="size-9 shrink-0 rounded-full" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20">
          <div className="flex size-14 items-center justify-center rounded-full bg-secondary">
            <MessageSquare className="size-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            {search || categoryFilter ? "No discussions matching your filters." : "No discussions yet. Start one!"}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((d) => (
            <Link
              key={d.id}
              to="/discussion/$id"
              params={{ id: d.id }}
              className="group block"
            >
              <div className="flex items-center gap-5 rounded-xl bg-card px-5 py-4 shadow-sm ring-1 ring-border/50 transition-all group-hover:shadow-md">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary">
                  <MessageSquare className="size-5 text-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-base font-bold">{d.title}</h3>
                    <Badge className={`shrink-0 rounded-lg text-[10px] px-2 py-0 ${CATEGORY_COLORS[d.category] ?? ""}`}>
                      {d.category}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {d.authorName ?? "Unknown"} · {formatDate(d.createdAt)}
                  </p>
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground/70">
                    <span className="flex items-center gap-1">
                      <MessageSquare className="size-3" />
                      {d.commentCount}
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart className="size-3" />
                      {d.reactionsCount}
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye className="size-3" />
                      {d.viewCount}
                    </span>
                  </div>
                </div>
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground transition-colors group-hover:bg-foreground group-hover:text-background">
                  <ArrowRight className="size-4" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!isLoading && totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="rounded-lg" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" className="rounded-lg" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Discussion</DialogTitle>
            <DialogDescription>Start a conversation with the community.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="disc-title">Title</Label>
              <Input id="disc-title" placeholder="What's on your mind?" value={title} onChange={(e) => setTitle(e.target.value)} className="rounded-lg bg-background" />
              {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="disc-category">Category</Label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.filter((c) => c.value).map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setCategory(value!)}
                    className={`h-8 rounded-lg px-3 text-sm font-medium transition-colors ${
                      category === value
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {errors.category && <p className="text-xs text-destructive">{errors.category}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="disc-content">Content</Label>
              <Textarea id="disc-content" placeholder="Share your thoughts..." value={content} onChange={(e) => setContent(e.target.value)} rows={5} className="rounded-lg bg-background" />
              {errors.content && <p className="text-xs text-destructive">{errors.content}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-lg" onClick={() => setCreateOpen(false)} disabled={isSubmitting}>Cancel</Button>
            <Button className="rounded-lg" onClick={handleCreate} disabled={isSubmitting}>{isSubmitting ? "Creating..." : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
