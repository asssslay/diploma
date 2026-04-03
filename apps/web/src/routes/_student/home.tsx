import { Link, createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { CalendarDays, MapPin, Users } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
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

  const [eventsList, setEventsList] = useState<EventItem[]>([]);
  const [eventsTotal, setEventsTotal] = useState(0);
  const [eventsPage, setEventsPage] = useState(1);
  const [eventsPageSize] = useState(6);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);

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

  return (
    <div className="mx-auto max-w-5xl space-y-12 p-6">
      {/* News Section */}
      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">News</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Latest updates from the university community.
          </p>
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
        ) : newsPosts.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
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
      </section>

      {/* Events Section */}
      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Upcoming Events
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            University events you can attend.
          </p>
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
        ) : eventsList.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            No upcoming events.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {eventsList.map((event) => (
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
      </section>
    </div>
  );
}
