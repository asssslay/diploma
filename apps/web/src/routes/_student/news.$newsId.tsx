import { Link, createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Eye, Newspaper, User, Calendar } from "lucide-react";
import { formatDate, isEdited } from "@/lib/utils";
import { toast } from "sonner";
import type { InferResponseType } from "hono/client";
import { hc } from "hono/client";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getApiClient } from "@/lib/api";
import type { AppType } from "server";

type Client = ReturnType<typeof hc<AppType>>;
type DetailEndpoint = Client["api"]["news"][":id"]["$get"];
type DetailResponse = Extract<
  InferResponseType<DetailEndpoint>,
  { success: true }
>;
type NewsPostDetail = DetailResponse["data"];

export const Route = createFileRoute("/_student/news/$newsId")({
  component: NewsDetailPage,
});

function NewsDetailPage() {
  const { newsId } = Route.useParams();
  const [post, setPost] = useState<NewsPostDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPost = useCallback(async () => {
    setIsLoading(true);
    try {
      const api = await getApiClient();
      const res = await api.api.news[":id"].$get({ param: { id: newsId } });

      if (!res.ok) {
        toast.error("Failed to load news post");
        return;
      }

      const json = (await res.json()) as DetailResponse;
      setPost(json.data);
    } catch {
      toast.error("Failed to load news post");
    } finally {
      setIsLoading(false);
    }
  }, [newsId]);

  useEffect(() => {
    fetchPost();
  }, [fetchPost]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
        <Skeleton className="h-8 w-16 rounded-lg" />
        <Skeleton className="h-8 w-3/4 rounded-lg" />
        <div className="flex gap-4">
          <Skeleton className="h-4 w-24 rounded-lg" />
          <Skeleton className="h-4 w-24 rounded-lg" />
          <Skeleton className="h-4 w-16 rounded-lg" />
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-full rounded-lg" />
          <Skeleton className="h-4 w-full rounded-lg" />
          <Skeleton className="h-4 w-2/3 rounded-lg" />
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-8">
        <Link to="/home">
          <Button variant="ghost" size="sm" className="rounded-lg">
            <ArrowLeft className="mr-2 size-4" />
            Back
          </Button>
        </Link>
        <div className="flex flex-col items-center gap-3 py-20">
          <div className="flex size-14 items-center justify-center rounded-full bg-secondary">
            <Newspaper className="size-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">News post not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
      <Link to="/home">
        <Button variant="ghost" size="sm" className="rounded-lg">
          <ArrowLeft className="mr-2 size-4" />
          Back
        </Button>
      </Link>

      <div className="rounded-xl bg-card p-6 shadow-sm ring-1 ring-border/50">
        <h1 className="text-2xl font-bold tracking-tight">{post.title}</h1>

        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <User className="size-4" />
            {post.authorName ?? "Unknown"}
          </span>
          <span className="flex items-center gap-1.5">
            <Calendar className="size-4" />
            {formatDate(post.publishedAt, { weekday: "short", month: "long" })}
            {post.updatedAt && isEdited(post.createdAt, post.updatedAt) && (
              <span className="text-muted-foreground/60">
                {" · Edited "}
                {formatDate(post.updatedAt)}
              </span>
            )}
          </span>
          <span className="flex items-center gap-1.5">
            <Eye className="size-4" />
            {post.viewCount} views
          </span>
        </div>

        {post.imageUrl && (
          <img
            src={post.imageUrl}
            alt={post.title}
            className="mt-6 w-full rounded-xl object-cover"
          />
        )}

        <div className="mt-6 whitespace-pre-wrap text-base leading-relaxed text-foreground/90">
          {post.content}
        </div>
      </div>
    </div>
  );
}
