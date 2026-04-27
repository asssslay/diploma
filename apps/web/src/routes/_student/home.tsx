import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  CalendarDays,
  Newspaper,
  Sparkles,
} from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/auth";

import { EventsTab, useEventsTabState } from "./home/events-tab";
import { NewsTab, useNewsTabState } from "./home/news-tab";

export const Route = createFileRoute("/_student/home")({
  component: HomePage,
});

function HomePage() {
  const { profile } = useAuth();
  const newsTab = useNewsTabState();
  const eventsTab = useEventsTabState();

  const registeredCount = useMemo(
    () => eventsTab.eventsList.filter((event) => event.isRegistered).length,
    [eventsTab.eventsList],
  );

  return (
    <div className="space-y-8 px-8 py-6">
      <div className="space-y-2">
        <h1 className="text-4xl">
          Welcome back
          {profile?.fullName ? `, ${profile.fullName.split(" ")[0]}` : ""}
        </h1>
        <p className="text-lg text-muted-foreground">
          Here's what's happening in your community.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex items-center gap-4 rounded-xl bg-card p-5 shadow-sm ring-1 ring-border/50">
          <div className="flex size-12 items-center justify-center rounded-lg bg-accent">
            <Newspaper className="size-5 text-accent-foreground" />
          </div>
          <div>
            <p className="text-3xl font-bold">{newsTab.total}</p>
            <p className="text-sm text-muted-foreground">News articles</p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-xl bg-card p-5 shadow-sm ring-1 ring-border/50">
          <div className="flex size-12 items-center justify-center rounded-lg bg-accent">
            <CalendarDays className="size-5 text-accent-foreground" />
          </div>
          <div>
            <p className="text-3xl font-bold">{eventsTab.total}</p>
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

      <Tabs defaultValue="news">
        <TabsList>
          <TabsTrigger value="news">News</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
        </TabsList>

        <TabsContent value="news">
          <NewsTab {...newsTab} />
        </TabsContent>

        <TabsContent value="events">
          <EventsTab {...eventsTab} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
