import { Link, createFileRoute } from "@tanstack/react-router";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: HomeComponent,
});

function HomeComponent() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-8 px-4">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">UniCommunity</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          University community platform
        </p>
      </div>
      <div className="flex w-full max-w-xs flex-col gap-3">
        <Link
          to="/login"
          className={cn(
            buttonVariants({ variant: "default" }),
            "h-10 w-full rounded-md text-sm",
          )}
        >
          Student Login
        </Link>
        <Link
          to="/admin/login"
          className={cn(
            buttonVariants({ variant: "outline" }),
            "h-10 w-full rounded-md text-sm",
          )}
        >
          Administrator Login
        </Link>
      </div>
    </div>
  );
}
