import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/_authenticated/news")({
  component: NewsPage,
});

function NewsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">News Management</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Create and manage news articles.
      </p>
    </div>
  );
}
