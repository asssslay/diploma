import { Link, createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownAZ,
  ArrowRight,
  ArrowUpAZ,
  CalendarDays,
  MapPin,
  Newspaper,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate, formatTime, isEdited } from "@/lib/utils";
import type { InferResponseType } from "hono/client";
import { hc } from "hono/client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/auth";
import { getApiClient } from "@/lib/api";
import type { AppType } from "server";

type Client = ReturnType<typeof hc<AppType>>;

type NewsListEndpoint = Client["api"]["news"]["$get"];
type NewsResponse = Extract<
  InferResponseType<NewsListEndpoint>,
  { success: true }
>;
type NewsPost = NewsResponse["data"][number];

type EventsListEndpoint = Client["api"]["events"]["$get"];
type EventsResponse = Extract<
  InferResponseType<EventsListEndpoint>,
  { success: true }
>;
type EventItem = EventsResponse["data"][number];

type EventFilter = "all" | "registered" | "available";

export const Route = createFileRoute("/_student/home")({
  component: HomePage,
});

function truncate(text: string, maxLength = 150): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + "...";
}

function HomePage() {
  const { profile } = useAuth();

  const [newsPosts, setNewsPosts] = useState<NewsPost[]>([]);
  const [newsTotal, setNewsTotal] = useState(0);
  const [newsPage, setNewsPage] = useState(1);
  const [newsPageSize] = useState(9);
  const [isLoadingNews, setIsLoadingNews] = useState(true);
  const [newsSearch, setNewsSearch] = useState("");
  const [newsSortAsc, setNewsSortAsc] = useState(false);
  const [newsSearchOpen, setNewsSearchOpen] = useState(false);

  const [eventsList, setEventsList] = useState<EventItem[]>([]);
  const [eventsTotal, setEventsTotal] = useState(0);
  const [eventsPage, setEventsPage] = useState(1);
  const [eventsPageSize] = useState(6);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [eventsSearch, setEventsSearch] = useState("");
  const [eventsSortAsc, setEventsSortAsc] = useState(false);
  const [eventsSearchOpen, setEventsSearchOpen] = useState(false);
  const [eventsFilter, setEventsFilter] = useState<EventFilter>("all");

  const newsTotalPages = Math.ceil(newsTotal / newsPageSize);
  const eventsTotalPages = Math.ceil(eventsTotal / eventsPageSize);

  const registeredCount = useMemo(
    () => eventsList.filter((e) => e.isRegistered).length,
    [eventsList],
  );

  const fetchNews = useCallback(async () => {
    setIsLoadingNews(true);
    try {
      const api = await getApiClient();
      const res = await api.api.news.$get({
        query: { page: String(newsPage), pageSize: String(newsPageSize) },
      });
      if (!res.ok) {
        toast.error("Failed to load news");
        return;
      }
      const json = (await res.json()) as NewsResponse;
      setNewsPosts(json.data);
      setNewsTotal(json.total);
    } catch {
      toast.error("Failed to load news");
    } finally {
      setIsLoadingNews(false);
    }
  }, [newsPage, newsPageSize]);

  const fetchEvents = useCallback(async () => {
    setIsLoadingEvents(true);
    try {
      const api = await getApiClient();
      const res = await api.api.events.$get({
        query: { page: String(eventsPage), pageSize: String(eventsPageSize) },
      });
      if (!res.ok) {
        toast.error("Failed to load events");
        return;
      }
      const json = (await res.json()) as EventsResponse;
      setEventsList(json.data);
      setEventsTotal(json.total);
    } catch {
      toast.error("Failed to load events");
    } finally {
      setIsLoadingEvents(false);
    }
  }, [eventsPage, eventsPageSize]);

  useEffect(() => {
    fetchNews();
  }, [fetchNews]);
  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const filteredNews = useMemo(() => {
    let result = [...newsPosts];
    if (newsSearch) {
      const q = newsSearch.toLowerCase();
      result = result.filter((p) => p.title.toLowerCase().includes(q));
    }
    result.sort((a, b) => {
      const da = new Date(a.publishedAt).getTime();
      const db = new Date(b.publishedAt).getTime();
      return newsSortAsc ? da - db : db - da;
    });
    return result;
  }, [newsPosts, newsSearch, newsSortAsc]);

  const filteredEvents = useMemo(() => {
    let result = [...eventsList];
    if (eventsSearch) {
      const q = eventsSearch.toLowerCase();
      result = result.filter((e) => e.title.toLowerCase().includes(q));
    }
    if (eventsFilter === "registered")
      result = result.filter((e) => e.isRegistered);
    else if (eventsFilter === "available")
      result = result.filter((e) => e.registrationCount < e.maxParticipants);
    result.sort((a, b) => {
      const da = new Date(a.eventDate).getTime();
      const db = new Date(b.eventDate).getTime();
      return eventsSortAsc ? da - db : db - da;
    });
    return result;
  }, [eventsList, eventsSearch, eventsSortAsc, eventsFilter]);

  return (
    <div className="space-y-8 px-8 py-6">
        {/* Hero */}
        <div className="space-y-2">
          <h1 className="text-4xl">
            Welcome back
            {profile?.fullName ? `, ${profile.fullName.split(" ")[0]}` : ""}
          </h1>
          <p className="text-lg text-muted-foreground">
            Here's what's happening in your community.
          </p>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex items-center gap-4 rounded-xl bg-card p-5 shadow-sm ring-1 ring-border/50">
            <div className="flex size-12 items-center justify-center rounded-lg bg-accent">
              <Newspaper className="size-5 text-accent-foreground" />
            </div>
            <div>
              <p className="text-3xl font-bold">{newsTotal}</p>
              <p className="text-sm text-muted-foreground">News articles</p>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-xl bg-card p-5 shadow-sm ring-1 ring-border/50">
            <div className="flex size-12 items-center justify-center rounded-lg bg-accent">
              <CalendarDays className="size-5 text-accent-foreground" />
            </div>
            <div>
              <p className="text-3xl font-bold">{eventsTotal}</p>
              <p className="text-sm text-muted-foreground">Upcoming events</p>
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-xl bg-card p-5 shadow-sm ring-1 ring-border/50">
            <div className="flex size-12 items-center justify-center rounded-lg bg-primary">
              <Sparkles className="size-5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-3xl font-bold">{registeredCount}</p>
              <p className="text-sm text-muted-foreground">
                Your registrations
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="news">
          <TabsList>
            <TabsTrigger value="news">News</TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
          </TabsList>

          {/* News Tab */}
          <TabsContent value="news" className="mt-6 space-y-5">
            <div className="flex items-center gap-2">
              {newsSearchOpen && (
                <Input
                  placeholder="Search news..."
                  value={newsSearch}
                  onChange={(e) => setNewsSearch(e.target.value)}
                  className="h-9 flex-1 rounded-lg bg-card shadow-sm ring-1 ring-border/50"
                  autoFocus
                />
              )}
              <button
                onClick={() => {
                  setNewsSearchOpen((v) => !v);
                  if (newsSearchOpen) setNewsSearch("");
                }}
                className="flex size-9 items-center justify-center rounded-lg bg-card shadow-sm ring-1 ring-border/50 transition-colors hover:bg-secondary"
              >
                <Search className="size-4 text-muted-foreground" />
              </button>
              <button
                onClick={() => setNewsSortAsc((v) => !v)}
                className="flex h-9 items-center gap-1.5 rounded-lg bg-card px-3 text-sm font-medium shadow-sm ring-1 ring-border/50 transition-colors hover:bg-secondary"
              >
                {newsSortAsc ? (
                  <ArrowUpAZ className="size-4" />
                ) : (
                  <ArrowDownAZ className="size-4" />
                )}
                {newsSortAsc ? "Oldest" : "Newest"}
              </button>
            </div>

            {isLoadingNews ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
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
                  {newsSearch
                    ? "No news matching your search."
                    : "No news posts yet."}
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
                        <h3 className="truncate text-base font-bold">
                          {post.title}
                        </h3>
                        <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                          {truncate(post.content, 120)}
                        </p>
                        <p className="mt-1.5 text-xs text-muted-foreground/70">
                          {formatDate(post.publishedAt, { month: "long" })}
                          {post.updatedAt && isEdited(post.createdAt, post.updatedAt) && (
                            <span> · Edited</span>
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

            {!isLoadingNews && newsTotalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <p className="text-sm text-muted-foreground">
                  Page {newsPage} of {newsTotalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    disabled={newsPage <= 1}
                    onClick={() => setNewsPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    disabled={newsPage >= newsTotalPages}
                    onClick={() => setNewsPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Events Tab */}
          <TabsContent value="events" className="mt-6 space-y-5">
            <div className="flex items-center gap-2">
              {eventsSearchOpen && (
                <Input
                  placeholder="Search events..."
                  value={eventsSearch}
                  onChange={(e) => setEventsSearch(e.target.value)}
                  className="h-9 flex-1 rounded-lg bg-card shadow-sm ring-1 ring-border/50"
                  autoFocus
                />
              )}
              <button
                onClick={() => {
                  setEventsSearchOpen((v) => !v);
                  if (eventsSearchOpen) setEventsSearch("");
                }}
                className="flex size-9 items-center justify-center rounded-lg bg-card shadow-sm ring-1 ring-border/50 transition-colors hover:bg-secondary"
              >
                <Search className="size-4 text-muted-foreground" />
              </button>
              <button
                onClick={() => setEventsSortAsc((v) => !v)}
                className="flex h-9 items-center gap-1.5 rounded-lg bg-card px-3 text-sm font-medium shadow-sm ring-1 ring-border/50 transition-colors hover:bg-secondary"
              >
                {eventsSortAsc ? (
                  <ArrowUpAZ className="size-4" />
                ) : (
                  <ArrowDownAZ className="size-4" />
                )}
                {eventsSortAsc ? "Oldest" : "Newest"}
              </button>
            </div>

            <div className="flex gap-2">
              {(["all", "registered", "available"] as const).map((value) => (
                <button
                  key={value}
                  onClick={() => setEventsFilter(value)}
                  className={`h-8 rounded-lg px-4 text-sm font-medium transition-colors ${
                    eventsFilter === value
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-muted-foreground ring-1 ring-border/50 hover:bg-secondary"
                  }`}
                >
                  {value === "all"
                    ? "All"
                    : value === "registered"
                      ? "Registered"
                      : "Available"}
                </button>
              ))}
            </div>

            {isLoadingEvents ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex flex-col justify-between rounded-xl bg-card p-5 shadow-sm ring-1 ring-border/50"
                  >
                    <div className="space-y-3">
                      <Skeleton className="size-10 rounded-full" />
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                    <div className="mt-4 flex items-end justify-between">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="size-8 rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredEvents.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-20">
                <div className="flex size-14 items-center justify-center rounded-full bg-secondary">
                  <CalendarDays className="size-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                  {eventsSearch || eventsFilter !== "all"
                    ? "No events matching your filters."
                    : "No upcoming events."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredEvents.map((event) => {
                  const spotsLeft =
                    event.maxParticipants - event.registrationCount;
                  const isFull = spotsLeft <= 0;

                  return (
                    <Link
                      key={event.id}
                      to="/events/$eventId"
                      params={{ eventId: event.id }}
                      className="group block"
                    >
                      <div className="flex h-full flex-col justify-between rounded-xl bg-card p-5 shadow-sm ring-1 ring-border/50 transition-all group-hover:-translate-y-0.5 group-hover:shadow-md">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex size-10 items-center justify-center rounded-full bg-secondary">
                              <CalendarDays className="size-4 text-foreground" />
                            </div>
                            {event.isRegistered ? (
                              <Badge className="rounded-full bg-accent text-accent-foreground text-[10px] px-2.5 py-0.5">
                                Registered
                              </Badge>
                            ) : isFull ? (
                              <Badge
                                variant="destructive"
                                className="rounded-full text-xs px-2.5 py-0.5"
                              >
                                Full
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="rounded-full text-xs px-2.5 py-0.5"
                              >
                                {spotsLeft} spots
                              </Badge>
                            )}
                          </div>
                          <h3 className="line-clamp-2 text-lg font-bold leading-snug">
                            {event.title}
                          </h3>
                          <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1.5">
                              <CalendarDays className="size-3" />
                              {formatDate(event.eventDate, { weekday: "short" })}
                              {" at "}
                              {formatTime(event.eventDate)}
                              {event.updatedAt && isEdited(event.createdAt, event.updatedAt) && (
                                <span className="text-muted-foreground/50"> · Edited</span>
                              )}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <MapPin className="size-3" />
                              {event.location}
                            </span>
                          </div>
                        </div>
                        <div className="mt-4 flex items-end justify-between">
                          <span className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Users className="size-3" />
                            {event.registrationCount}/{event.maxParticipants}
                          </span>
                          <div className="flex size-8 items-center justify-center rounded-full bg-secondary text-foreground transition-colors group-hover:bg-foreground group-hover:text-background">
                            <ArrowRight className="size-3.5" />
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}

            {!isLoadingEvents && eventsTotalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <p className="text-sm text-muted-foreground">
                  Page {eventsPage} of {eventsTotalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    disabled={eventsPage <= 1}
                    onClick={() => setEventsPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    disabled={eventsPage >= eventsTotalPages}
                    onClick={() => setEventsPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
    </div>
  );
}
