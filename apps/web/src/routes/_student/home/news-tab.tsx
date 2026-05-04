import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownAZ,
  ArrowRight,
  ArrowUpAZ,
  Newspaper,
  Search,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { getApiClient } from "@/lib/api";
import { formatDate, isEdited } from "@/lib/utils";

import type { NewsListData, NewsPost } from "./types";

type NewsTabState = {
  newsPosts: NewsPost[];
  total: number;
  page: number;
  totalPages: number;
  isLoading: boolean;
  search: string;
  searchOpen: boolean;
  sortAsc: boolean;
  filteredNews: NewsPost[];
  setPage: React.Dispatch<React.SetStateAction<number>>;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
  setSearchOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSortAsc: React.Dispatch<React.SetStateAction<boolean>>;
};

export function useNewsTabState(): NewsTabState {
  const [newsPosts, setNewsPosts] = useState<NewsPost[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 9;
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortAsc, setSortAsc] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const totalPages = Math.ceil(total / pageSize);

  const fetchNews = useCallback(async () => {
    setIsLoading(true);
    try {
      const api = await getApiClient();
      const response = await api.api.news.$get({
        query: { page: String(page), pageSize: String(pageSize) },
      });
      if (!response.ok) {
        toast.error("Failed to load news");
        return;
      }

      const json = (await response.json()) as NewsListData;
      setNewsPosts(json.data);
      setTotal(json.total);
    } catch {
      toast.error("Failed to load news");
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  const filteredNews = useMemo(() => {
    let result = [...newsPosts];
    if (search) {
      const query = search.toLowerCase();
      result = result.filter((post) => post.title.toLowerCase().includes(query));
    }

    result.sort((left, right) => {
      const leftDate = new Date(left.publishedAt).getTime();
      const rightDate = new Date(right.publishedAt).getTime();
      return sortAsc ? leftDate - rightDate : rightDate - leftDate;
    });

    return result;
  }, [newsPosts, search, sortAsc]);

  return {
    newsPosts,
    total,
    page,
    totalPages,
    isLoading,
    search,
    searchOpen,
    sortAsc,
    filteredNews,
    setPage,
    setSearch,
    setSearchOpen,
    setSortAsc,
  };
}

export function NewsTab({
  page,
  totalPages,
  isLoading,
  search,
  searchOpen,
  sortAsc,
  filteredNews,
  setPage,
  setSearch,
  setSearchOpen,
  setSortAsc,
}: NewsTabState) {
  return (
    <div className="mt-6 space-y-5">
      <div className="flex items-center gap-2">
        {searchOpen && (
          <Input
            placeholder="Search news..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-9 flex-1 rounded-lg bg-card shadow-sm ring-1 ring-border/50"
            autoFocus
          />
        )}
        <Button
          aria-label={searchOpen ? "Close news search" : "Open news search"}
          onClick={() => {
            setSearchOpen((value) => !value);
            if (searchOpen) setSearch("");
          }}
          variant="outline"
          size="icon"
          className="size-9 rounded-lg bg-card shadow-sm ring-1 ring-border/50 hover:bg-secondary"
        >
          <Search className="size-4 text-muted-foreground" />
        </Button>
        <Button
          aria-label="Sort news by publish date"
          onClick={() => setSortAsc((value) => !value)}
          variant="outline"
          size="sm"
          className="h-9 rounded-lg bg-card text-sm shadow-sm ring-1 ring-border/50 hover:bg-secondary"
        >
          {sortAsc ? (
            <ArrowUpAZ className="size-4" />
          ) : (
            <ArrowDownAZ className="size-4" />
          )}
          {sortAsc ? "Oldest" : "Newest"}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="flex items-center gap-5 rounded-xl bg-card px-5 py-4 shadow-sm ring-1 ring-border/50"
            >
              <Skeleton className="size-11 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-3.5 w-full" />
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="size-9 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredNews.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20">
          <div className="flex size-14 items-center justify-center rounded-full bg-secondary">
            <Newspaper className="size-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            {search ? "No news matching your search." : "No news posts yet."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredNews.map((post) => (
            <Link
              key={post.id}
              to="/news/$newsId"
              params={{ newsId: post.id }}
              className="group block"
            >
              <div className="flex items-center gap-5 rounded-xl bg-card px-5 py-4 shadow-sm ring-1 ring-border/50 transition-all group-hover:shadow-md">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary">
                  <Newspaper className="size-5 text-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-base font-bold">{post.title}</h3>
                  <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                    {post.excerpt}
                  </p>
                  <p className="mt-1.5 text-xs text-muted-foreground/70">
                    {formatDate(post.publishedAt, { month: "long" })}
                    {post.updatedAt && isEdited(post.createdAt, post.updatedAt) && (
                      <span> - Edited</span>
                    )}
                  </p>
                </div>
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground transition-colors group-hover:bg-foreground group-hover:text-background">
                  <ArrowRight className="size-4" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {!isLoading && totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              disabled={page <= 1}
              onClick={() => setPage((value) => value - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              disabled={page >= totalPages}
              onClick={() => setPage((value) => value + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
