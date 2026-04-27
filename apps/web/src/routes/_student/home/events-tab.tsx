import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownAZ,
  ArrowRight,
  ArrowUpAZ,
  CalendarDays,
  MapPin,
  Search,
  Users,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { getApiClient } from "@/lib/api";
import { formatDate, formatTime, isEdited } from "@/lib/utils";

import type { EventFilter, EventItem, EventsListData } from "./types";

type EventsTabState = {
  eventsList: EventItem[];
  total: number;
  page: number;
  totalPages: number;
  isLoading: boolean;
  search: string;
  searchOpen: boolean;
  sortAsc: boolean;
  filter: EventFilter;
  filteredEvents: EventItem[];
  setPage: React.Dispatch<React.SetStateAction<number>>;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
  setSearchOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSortAsc: React.Dispatch<React.SetStateAction<boolean>>;
  setFilter: React.Dispatch<React.SetStateAction<EventFilter>>;
};

const EVENT_FILTER_OPTIONS: Array<{ value: EventFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "registered", label: "Registered" },
  { value: "available", label: "Available" },
];

export function useEventsTabState(): EventsTabState {
  const [eventsList, setEventsList] = useState<EventItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 6;
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortAsc, setSortAsc] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [filter, setFilter] = useState<EventFilter>("all");

  const totalPages = Math.ceil(total / pageSize);

  const fetchEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      const api = await getApiClient();
      const response = await api.api.events.$get({
        query: { page: String(page), pageSize: String(pageSize) },
      });
      if (!response.ok) {
        toast.error("Failed to load events");
        return;
      }

      const json = (await response.json()) as EventsListData;
      setEventsList(json.data);
      setTotal(json.total);
    } catch {
      toast.error("Failed to load events");
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const filteredEvents = useMemo(() => {
    let result = [...eventsList];
    if (search) {
      const query = search.toLowerCase();
      result = result.filter((event) =>
        event.title.toLowerCase().includes(query),
      );
    }

    if (filter === "registered") {
      result = result.filter((event) => event.isRegistered);
    } else if (filter === "available") {
      result = result.filter(
        (event) => event.registrationCount < event.maxParticipants,
      );
    }

    result.sort((left, right) => {
      const leftDate = new Date(left.eventDate).getTime();
      const rightDate = new Date(right.eventDate).getTime();
      return sortAsc ? leftDate - rightDate : rightDate - leftDate;
    });

    return result;
  }, [eventsList, search, sortAsc, filter]);

  return {
    eventsList,
    total,
    page,
    totalPages,
    isLoading,
    search,
    searchOpen,
    sortAsc,
    filter,
    filteredEvents,
    setPage,
    setSearch,
    setSearchOpen,
    setSortAsc,
    setFilter,
  };
}

export function EventsTab({
  page,
  totalPages,
  isLoading,
  search,
  searchOpen,
  sortAsc,
  filter,
  filteredEvents,
  setPage,
  setSearch,
  setSearchOpen,
  setSortAsc,
  setFilter,
}: EventsTabState) {
  return (
    <div className="mt-6 space-y-5">
      <div className="flex items-center gap-2">
        {searchOpen && (
          <Input
            placeholder="Search events..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-9 flex-1 rounded-lg bg-card shadow-sm ring-1 ring-border/50"
            autoFocus
          />
        )}
        <button
          type="button"
          aria-label={searchOpen ? "Close events search" : "Open events search"}
          onClick={() => {
            setSearchOpen((value) => !value);
            if (searchOpen) setSearch("");
          }}
          className="flex size-9 items-center justify-center rounded-lg bg-card shadow-sm ring-1 ring-border/50 transition-colors hover:bg-secondary"
        >
          <Search className="size-4 text-muted-foreground" />
        </button>
        <button
          type="button"
          aria-label="Sort events by date"
          onClick={() => setSortAsc((value) => !value)}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-card px-3 text-sm font-medium shadow-sm ring-1 ring-border/50 transition-colors hover:bg-secondary"
        >
          {sortAsc ? (
            <ArrowUpAZ className="size-4" />
          ) : (
            <ArrowDownAZ className="size-4" />
          )}
          {sortAsc ? "Oldest" : "Newest"}
        </button>
      </div>

      <div className="flex gap-2">
        {EVENT_FILTER_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setFilter(option.value)}
            className={`h-8 rounded-lg px-4 text-sm font-medium transition-colors ${
              filter === option.value
                ? "bg-primary text-primary-foreground"
                : "bg-card text-muted-foreground ring-1 ring-border/50 hover:bg-secondary"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
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
            {search || filter !== "all"
              ? "No events matching your filters."
              : "No upcoming events."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredEvents.map((event) => {
            const spotsLeft = event.maxParticipants - event.registrationCount;
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
                        <Badge className="rounded-full bg-accent px-2.5 py-0.5 text-[10px] text-accent-foreground">
                          Registered
                        </Badge>
                      ) : isFull ? (
                        <Badge
                          variant="destructive"
                          className="rounded-full px-2.5 py-0.5 text-xs"
                        >
                          Full
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="rounded-full px-2.5 py-0.5 text-xs"
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
                        {event.updatedAt &&
                          isEdited(event.createdAt, event.updatedAt) && (
                            <span className="text-muted-foreground/50">
                              {" "}
                              - Edited
                            </span>
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
