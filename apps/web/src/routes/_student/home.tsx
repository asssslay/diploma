import { Link, createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import type { InferResponseType } from "hono/client";
import { hc } from "hono/client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getApiClient } from "@/lib/api";
import type { AppType } from "server";

type Client = ReturnType<typeof hc<AppType>>;
type ListEndpoint = Client["api"]["news"]["$get"];
type SuccessResponse = Extract<
  InferResponseType<ListEndpoint>,
  { success: true }
>;
type NewsPost = SuccessResponse["data"][number];

export const Route = createFileRoute("/_student/home")({
  component: HomePage,
});

function truncate(text: string, maxLength = 150): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + "...";
}

function HomePage() {
  const [newsPosts, setNewsPosts] = useState<NewsPost[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(9);
  const [isLoading, setIsLoading] = useState(true);

  const totalPages = Math.ceil(total / pageSize);

  const fetchNews = useCallback(async () => {
    setIsLoading(true);
    try {
      const api = await getApiClient();
      const res = await api.api.news.$get({
        query: {
          page: String(page),
          pageSize: String(pageSize),
        },
      });

      if (!res.ok) {
        toast.error("Failed to load news");
        return;
      }

      const json = (await res.json()) as SuccessResponse;
      setNewsPosts(json.data);
      setTotal(json.total);
    } catch {
      toast.error("Failed to load news");
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">News</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Latest updates from the university community.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/3" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-3 w-full" />
                <Skeleton className="mt-1 h-3 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : newsPosts.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          No news posts yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {newsPosts.map((post) => (
            <Link
              key={post.id}
              to="/news/$id"
              params={{ id: post.id }}
              className="block transition-opacity hover:opacity-80"
            >
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>{post.title}</CardTitle>
                  <CardDescription>
                    {new Date(post.publishedAt).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {truncate(post.content)}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {!isLoading && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
