import { Link, createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CalendarDays, MapPin, User, Users } from "lucide-react";
import { toast } from "sonner";
import type { InferResponseType } from "hono/client";
import { hc } from "hono/client";

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

export const Route = createFileRoute("/_student/events/$id")({
  component: EventDetailPage,
});

function EventDetailPage() {
  const { id } = Route.useParams();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);

  const fetchEvent = useCallback(async () => {
    setIsLoading(true);
    try {
      const api = await getApiClient();
      const res = await api.api.events[":id"].$get({ param: { id } });

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
  }, [id]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  async function handleRegister() {
    setIsRegistering(true);
    try {
      const api = await getApiClient();
      const res = await api.api.events[":id"].register.$post({
        param: { id },
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
        param: { id },
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

  if (!event) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Link to="/home">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 size-4" />
            Back
          </Button>
        </Link>
        <p className="mt-8 text-center text-muted-foreground">
          Event not found.
        </p>
      </div>
    );
  }

  const spotsLeft = event.maxParticipants - event.registrationCount;
  const isFull = spotsLeft <= 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <Link to="/home">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-2 size-4" />
          Back
        </Button>
      </Link>

      <h1 className="text-2xl font-bold tracking-tight">{event.title}</h1>

      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1">
          <User className="size-3.5" />
          {event.authorName ?? "Unknown"}
        </span>
        <span className="flex items-center gap-1">
          <CalendarDays className="size-3.5" />
          {new Date(event.eventDate).toLocaleString()}
        </span>
        <span className="flex items-center gap-1">
          <MapPin className="size-3.5" />
          {event.location}
        </span>
        <span className="flex items-center gap-1">
          <Users className="size-3.5" />
          {event.registrationCount} / {event.maxParticipants} registered
        </span>
      </div>

      {event.imageUrl && (
        <img
          src={event.imageUrl}
          alt={event.title}
          className="w-full rounded-md object-cover"
        />
      )}

      <div className="whitespace-pre-wrap text-sm leading-relaxed">
        {event.description}
      </div>

      <div className="border-t pt-4">
        {event.isRegistered ? (
          <Button
            variant="outline"
            onClick={handleUnregister}
            disabled={isRegistering}
          >
            {isRegistering ? "Unregistering..." : "Unregister"}
          </Button>
        ) : isFull ? (
          <Tooltip>
            <TooltipTrigger>
              <Button disabled>Event Full</Button>
            </TooltipTrigger>
            <TooltipContent>
              All {event.maxParticipants} spots have been taken.
            </TooltipContent>
          </Tooltip>
        ) : (
          <Button onClick={handleRegister} disabled={isRegistering}>
            {isRegistering ? "Registering..." : "Register"}
          </Button>
        )}
      </div>
    </div>
  );
}
