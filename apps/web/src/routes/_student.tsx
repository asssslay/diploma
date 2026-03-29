import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { Clock, XCircle } from "lucide-react";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/auth";
import { Button } from "@/components/ui/button";

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

  if (!profile) return null;

  if (profile.status === "pending") {
    return (
      <div className="flex min-h-svh items-center justify-center px-4">
        <div className="max-w-sm text-center">
          <Clock className="mx-auto size-12 text-muted-foreground" />
          <h1 className="mt-4 text-2xl font-bold tracking-tight">
            Application Under Review
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account is awaiting approval from an administrator. You'll get
            access once your application is reviewed.
          </p>
          <Button variant="outline" className="mt-6" onClick={() => signOut()}>
            Sign Out
          </Button>
        </div>
      </div>
    );
  }

  if (profile.status === "rejected") {
    return (
      <div className="flex min-h-svh items-center justify-center px-4">
        <div className="max-w-sm text-center">
          <XCircle className="mx-auto size-12 text-destructive" />
          <h1 className="mt-4 text-2xl font-bold tracking-tight">
            Application Rejected
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Unfortunately, your application was not approved.
          </p>
          {profile.rejectionReason && (
            <div className="mt-4 rounded-md border bg-muted/50 p-4 text-left text-sm">
              <p className="font-medium">Reason:</p>
              <p className="mt-1 text-muted-foreground">
                {profile.rejectionReason}
              </p>
            </div>
          )}
          <Button variant="outline" className="mt-6" onClick={() => signOut()}>
            Sign Out
          </Button>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
