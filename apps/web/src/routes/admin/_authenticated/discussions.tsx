import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/_authenticated/discussions")({
  component: DiscussionsPage,
});

function DiscussionsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">
        Discussion Moderation
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Review and moderate community discussions.
      </p>
    </div>
  );
}
