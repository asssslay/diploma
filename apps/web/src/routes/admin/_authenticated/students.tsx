import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/_authenticated/students")({
  component: StudentsPage,
});

function StudentsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Student List</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Manage registered students and applications.
      </p>
    </div>
  );
}
