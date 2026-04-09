import { Link, createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CalendarDays, MapPin, User, Users } from "lucide-react";
import { formatDate, isEdited } from "@/lib/utils";
import { toast } from "sonner";
import type { InferResponseType } from "hono/client";
import { hc } from "hono/client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getApiClient } from "@/lib/api";
import type { AppType } from "server";

type Client = ReturnType<typeof hc<AppType>>;
type DetailEndpoint = Client["api"]["events"][":id"]["$get"];
type DetailResponse = Extract<
  InferResponseType<DetailEndpoint>,
  { success: true }
>;
type EventDetail = DetailResponse["data"];

export const Route = createFileRoute("/_student/events/$eventId")({
  component: EventDetailPage,
});

function EventDetailPage() {
  const { eventId } = Route.useParams();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);

  const fetchEvent = useCallback(async () => {
    setIsLoading(true);
    try {
      const api = await getApiClient();
      const res = await api.api.events[":id"].$get({ param: { id: eventId } });

      if (!res.ok) {
        toast.error("Failed to load event");
        return;
      }

      const json = (await res.json()) as DetailResponse;
      setEvent(json.data);
    } catch {
      toast.error("Failed to load event");
    } finally {
      setIsLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  async function handleRegister() {
    setIsRegistering(true);
    try {
      const api = await getApiClient();
      const res = await api.api.events[":id"].register.$post({
        param: { id: eventId },
      });

      if (!res.ok) {
        toast.error("Failed to register");
        return;
      }

      toast.success("Registered for event");
      fetchEvent();
    } catch {
      toast.error("Failed to register");
    } finally {
      setIsRegistering(false);
    }
  }

  async function handleUnregister() {
    setIsRegistering(true);
    try {
      const api = await getApiClient();
      const res = await api.api.events[":id"].register.$delete({
        param: { id: eventId },
      });

      if (!res.ok) {
        toast.error("Failed to unregister");
        return;
      }

      toast.success("Unregistered from event");
      fetchEvent();
    } catch {
      toast.error("Failed to unregister");
    } finally {
      setIsRegistering(false);
    }
  }

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

  if (!event) {
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
            <CalendarDays className="size-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">Event not found.</p>
        </div>
      </div>
    );
  }

  const spotsLeft = event.maxParticipants - event.registrationCount;
  const isFull = spotsLeft <= 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
      <Link to="/home">
        <Button variant="ghost" size="sm" className="rounded-lg">
          <ArrowLeft className="mr-2 size-4" />
          Back
        </Button>
      </Link>

      <div className="rounded-xl bg-card p-6 shadow-sm ring-1 ring-border/50">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{event.title}</h1>
          {event.isRegistered ? (
            <Badge className="shrink-0 rounded-lg bg-accent text-accent-foreground">
              Registered
            </Badge>
          ) : isFull ? (
            <Badge variant="destructive" className="shrink-0 rounded-lg">
              Full
            </Badge>
          ) : (
            <Badge variant="outline" className="shrink-0 rounded-lg">
              {spotsLeft} spots left
            </Badge>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="flex items-center gap-2 rounded-lg bg-background p-3">
            <User className="size-4 text-muted-foreground" />
            <div>
              <p className="text-[10px] text-muted-foreground">Author</p>
              <p className="text-xs font-medium">{event.authorName ?? "Unknown"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-background p-3">
            <CalendarDays className="size-4 text-muted-foreground" />
            <div>
              <p className="text-[10px] text-muted-foreground">Date</p>
              <p className="text-xs font-medium">
                {formatDate(event.eventDate)}
                {event.updatedAt && isEdited(event.createdAt, event.updatedAt) && (
                  <span className="text-muted-foreground/60 font-normal"> · Edited</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-background p-3">
            <MapPin className="size-4 text-muted-foreground" />
            <div>
              <p className="text-[10px] text-muted-foreground">Location</p>
              <p className="text-xs font-medium">{event.location}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-background p-3">
            <Users className="size-4 text-muted-foreground" />
            <div>
              <p className="text-[10px] text-muted-foreground">Registered</p>
              <p className="text-xs font-medium">
                {event.registrationCount} / {event.maxParticipants}
              </p>
            </div>
          </div>
        </div>

        {event.imageUrl && (
          <img
            src={event.imageUrl}
            alt={event.title}
            className="mt-6 w-full rounded-xl object-cover"
          />
        )}

        <div className="mt-6 whitespace-pre-wrap text-base leading-relaxed text-foreground/90">
          {event.description}
        </div>

        <div className="mt-6 border-t border-border/50 pt-5">
          {event.isRegistered ? (
            <Button
              variant="outline"
              className="rounded-lg"
              onClick={handleUnregister}
              disabled={isRegistering}
            >
              {isRegistering ? "Unregistering..." : "Unregister"}
            </Button>
          ) : isFull ? (
            <Tooltip>
              <TooltipTrigger>
                <Button disabled className="rounded-lg">
                  Event Full
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                All {event.maxParticipants} spots have been taken.
              </TooltipContent>
            </Tooltip>
          ) : (
            <Button
              className="rounded-lg"
              onClick={handleRegister}
              disabled={isRegistering}
            >
              {isRegistering ? "Registering..." : "Register for Event"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
