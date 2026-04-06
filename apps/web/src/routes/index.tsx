import { Link, createFileRoute } from "@tanstack/react-router";
import { GraduationCap, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

function HomeComponent() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-10 text-center">
        <div className="space-y-3">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-accent">
            <GraduationCap className="size-7 text-accent-foreground" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            UniCommunity
          </h1>
          <p className="text-base text-muted-foreground">
            University community platform
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Link
            to="/login"
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <GraduationCap className="size-4" />
            Student Login
          </Link>
          <Link
            to="/admin/login"
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-card text-sm font-semibold text-foreground shadow-sm ring-1 ring-border/50 transition-colors hover:bg-secondary"
          >
            <ShieldCheck className="size-4" />
            Administrator Login
          </Link>
        </div>
      </div>
    </div>
  );
}
