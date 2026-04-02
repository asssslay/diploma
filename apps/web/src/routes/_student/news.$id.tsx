import { Link, createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Eye, User, Calendar } from "lucide-react";
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

export const Route = createFileRoute("/_student/news/$id")({
  component: NewsDetailPage,
});

function NewsDetailPage() {
  const { id } = Route.useParams();
  const [post, setPost] = useState<NewsPostDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPost = useCallback(async () => {
    setIsLoading(true);
    try {
      const api = await getApiClient();
      const res = await api.api.news[":id"].$get({ param: { id } });

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
  }, [id]);

  useEffect(() => {
    fetchPost();
  }, [fetchPost]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-3/4" />
        <div className="flex gap-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>
        <Skeleton className="h-64 w-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Link to="/home">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 size-4" />
            Back
          </Button>
        </Link>
        <p className="mt-8 text-center text-muted-foreground">
          News post not found.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <Link to="/home">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-2 size-4" />
          Back
        </Button>
      </Link>

      <h1 className="text-2xl font-bold tracking-tight">{post.title}</h1>

      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1">
          <User className="size-3.5" />
          {post.authorName ?? "Unknown"}
        </span>
        <span className="flex items-center gap-1">
          <Calendar className="size-3.5" />
          {new Date(post.publishedAt).toLocaleDateString()}
        </span>
        <span className="flex items-center gap-1">
          <Eye className="size-3.5" />
          {post.viewCount} views
        </span>
      </div>

      {post.imageUrl && (
        <img
          src={post.imageUrl}
          alt={post.title}
          className="w-full rounded-md object-cover"
        />
      )}

      <div className="whitespace-pre-wrap text-sm leading-relaxed">
        {post.content}
      </div>
    </div>
  );
}
