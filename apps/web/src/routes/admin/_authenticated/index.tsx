import { createFileRoute } from "@tanstack/react-router";
import { LayoutDashboard } from "lucide-react";

export const Route = createFileRoute("/admin/_authenticated/")({
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Overview of platform activity.
        </p>
      </div>

      <div className="flex flex-col items-center gap-3 py-20">
        <div className="flex size-14 items-center justify-center rounded-full bg-secondary">
          <LayoutDashboard className="size-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">
          Dashboard analytics coming soon.
        </p>
      </div>
    </div>
  );
}
