import { Outlet, createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { Clock, XCircle } from "lucide-react";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/auth";
import { Button } from "@/components/ui/button";
import { StudentSidebar } from "@/components/student-sidebar";

export const Route = createFileRoute("/_student")({
  beforeLoad: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      throw redirect({ to: "/login" });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single();

    if (profile?.role === "admin") {
      throw redirect({ to: "/admin" });
    }
  },
  component: StudentLayout,
});

function StudentLayout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    await navigate({ to: "/login" });
  }

  if (!profile) return null;

  if (profile.status === "pending") {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background px-4">
        <div className="max-w-sm text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-secondary">
            <Clock className="size-7 text-muted-foreground" />
          </div>
          <h1 className="mt-5 text-2xl font-bold tracking-tight">
            Application Under Review
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account is awaiting approval from an administrator. You'll get
            access once your application is reviewed.
          </p>
          <Button
            variant="outline"
            className="mt-6 rounded-lg"
            onClick={handleSignOut}
          >
            Sign Out
          </Button>
        </div>
      </div>
    );
  }

  if (profile.status === "rejected") {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background px-4">
        <div className="max-w-sm text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-destructive/10">
            <XCircle className="size-7 text-destructive" />
          </div>
          <h1 className="mt-5 text-2xl font-bold tracking-tight">
            Application Rejected
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Unfortunately, your application was not approved.
          </p>
          {profile.rejectionReason && (
            <div className="mt-4 rounded-xl bg-card p-4 text-left shadow-sm ring-1 ring-border/50">
              <p className="text-xs font-semibold text-foreground">Reason:</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {profile.rejectionReason}
              </p>
            </div>
          )}
          <Button
            variant="outline"
            className="mt-6 rounded-lg"
            onClick={handleSignOut}
          >
            Sign Out
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh bg-background">
      <StudentSidebar />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
