import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/_authenticated/events")({
  component: EventsPage,
});

function EventsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Event Management</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Create and manage university events.
      </p>
    </div>
  );
}
