import { Link, createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownAZ,
  ArrowUpAZ,
  CalendarDays,
  MapPin,
  Search,
  Users,
} from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const [newsPosts, setNewsPosts] = useState<NewsPost[]>([]);
  const [newsTotal, setNewsTotal] = useState(0);
  const [newsPage, setNewsPage] = useState(1);
  const [newsPageSize] = useState(9);
  const [isLoadingNews, setIsLoadingNews] = useState(true);
  const [newsSearch, setNewsSearch] = useState("");
  const [newsSortAsc, setNewsSortAsc] = useState(false);

  const [eventsList, setEventsList] = useState<EventItem[]>([]);
  const [eventsTotal, setEventsTotal] = useState(0);
  const [eventsPage, setEventsPage] = useState(1);
  const [eventsPageSize] = useState(6);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [eventsSearch, setEventsSearch] = useState("");
  const [eventsSortAsc, setEventsSortAsc] = useState(false);
  const [eventsFilter, setEventsFilter] = useState<EventFilter>("all");

  const newsTotalPages = Math.ceil(newsTotal / newsPageSize);
  const eventsTotalPages = Math.ceil(eventsTotal / eventsPageSize);

  const fetchNews = useCallback(async () => {
    setIsLoadingNews(true);
    try {
      const api = await getApiClient();
      const res = await api.api.news.$get({
        query: {
          page: String(newsPage),
          pageSize: String(newsPageSize),
        },
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
        query: {
          page: String(eventsPage),
          pageSize: String(eventsPageSize),
        },
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

    if (eventsFilter === "registered") {
      result = result.filter((e) => e.isRegistered);
    } else if (eventsFilter === "available") {
      result = result.filter((e) => e.registrationCount < e.maxParticipants);
    }

    result.sort((a, b) => {
      const da = new Date(a.eventDate).getTime();
      const db = new Date(b.eventDate).getTime();
      return eventsSortAsc ? da - db : db - da;
    });

    return result;
  }, [eventsList, eventsSearch, eventsSortAsc, eventsFilter]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Home</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Stay up to date with the university community.
        </p>
      </div>

      <Tabs defaultValue="news">
        <TabsList>
          <TabsTrigger value="news">News</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
        </TabsList>

        {/* News Tab */}
        <TabsContent value="news" className="mt-4 space-y-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search news..."
                value={newsSearch}
                onChange={(e) => setNewsSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setNewsSortAsc((v) => !v)}
              title={newsSortAsc ? "Oldest first" : "Newest first"}
            >
              {newsSortAsc ? (
                <ArrowUpAZ className="mr-1.5 size-3.5" />
              ) : (
                <ArrowDownAZ className="mr-1.5 size-3.5" />
              )}
              {newsSortAsc ? "Oldest" : "Newest"}
            </Button>
          </div>

          {isLoadingNews ? (
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
          ) : filteredNews.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              {newsSearch ? "No news matching your search." : "No news posts yet."}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredNews.map((post) => (
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

          {!isLoadingNews && newsTotalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {newsPage} of {newsTotalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={newsPage <= 1}
                  onClick={() => setNewsPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
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
        <TabsContent value="events" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search events..."
                value={eventsSearch}
                onChange={(e) => setEventsSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEventsSortAsc((v) => !v)}
              title={eventsSortAsc ? "Oldest first" : "Newest first"}
            >
              {eventsSortAsc ? (
                <ArrowUpAZ className="mr-1.5 size-3.5" />
              ) : (
                <ArrowDownAZ className="mr-1.5 size-3.5" />
              )}
              {eventsSortAsc ? "Oldest" : "Newest"}
            </Button>
          </div>

          <div className="flex gap-1">
            {(["all", "registered", "available"] as const).map((value) => (
              <Button
                key={value}
                variant={eventsFilter === value ? "default" : "outline"}
                size="sm"
                onClick={() => setEventsFilter(value)}
              >
                {value === "all"
                  ? "All"
                  : value === "registered"
                    ? "Registered"
                    : "Available"}
              </Button>
            ))}
          </div>

          {isLoadingEvents ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="mt-1 h-3 w-1/2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              {eventsSearch || eventsFilter !== "all"
                ? "No events matching your filters."
                : "No upcoming events."}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredEvents.map((event) => (
                <Link
                  key={event.id}
                  to="/events/$id"
                  params={{ id: event.id }}
                  className="block transition-opacity hover:opacity-80"
                >
                  <Card className="h-full">
                    <CardHeader>
                      <CardTitle>{event.title}</CardTitle>
                      <CardDescription className="flex items-center gap-1">
                        <CalendarDays className="size-3" />
                        {new Date(event.eventDate).toLocaleDateString()}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <p className="flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="size-3" />
                        {event.location}
                      </p>
                      <div className="flex items-center gap-2">
                        <p className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Users className="size-3" />
                          {event.registrationCount} / {event.maxParticipants}
                        </p>
                        {event.isRegistered && (
                          <Badge variant="secondary">Registered</Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}

          {!isLoadingEvents && eventsTotalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {eventsPage} of {eventsTotalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={eventsPage <= 1}
                  onClick={() => setEventsPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
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
