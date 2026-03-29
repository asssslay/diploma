import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_student/dashboard")({
  component: StudentDashboard,
});

function StudentDashboard() {
  return (
    <div className="flex min-h-svh items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          Welcome to UniCommunity
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your student dashboard will be here.
        </p>
      </div>
    </div>
  );
}
