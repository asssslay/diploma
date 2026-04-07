import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  CalendarDays,
  GraduationCap,
  Mail,
  Pencil,
  Shield,
  User,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import type { InferResponseType } from "hono/client";
import { hc } from "hono/client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/utils";
import { getApiClient } from "@/lib/api";
import type { AppType } from "server";

type Client = ReturnType<typeof hc<AppType>>;
type MeEndpoint = Client["api"]["profile"]["me"]["$get"];
type MeResponse = Extract<InferResponseType<MeEndpoint>, { success: true }>;
type Profile = MeResponse["data"];

export const Route = createFileRoute("/_student/profile")({
  component: ProfilePage,
});

const STATUS_BADGE = {
  pending: { variant: "outline" as const, label: "Pending" },
  approved: { variant: "default" as const, label: "Approved" },
  rejected: { variant: "destructive" as const, label: "Rejected" },
};

function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    setIsLoading(true);
    try {
      const api = await getApiClient();
      const res = await api.api.profile.me.$get();
      if (!res.ok) { toast.error("Failed to load profile"); return; }
      const json = (await res.json()) as MeResponse;
      setProfile(json.data);
    } catch { toast.error("Failed to load profile"); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
        <div className="flex items-center gap-5">
          <Skeleton className="size-20 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="flex flex-col items-center gap-3 py-20">
          <div className="flex size-14 items-center justify-center rounded-full bg-secondary">
            <User className="size-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">Profile not found.</p>
        </div>
      </div>
    );
  }

  const statusBadge = STATUS_BADGE[profile.status];

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-5">
          <div className="flex size-20 items-center justify-center rounded-full bg-accent">
            <User className="size-9 text-accent-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {profile.fullName ?? "Student"}
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {profile.email}
            </p>
          </div>
        </div>
        <Button variant="outline" className="rounded-lg gap-2" disabled>
          <Pencil className="size-4" />
          Edit Profile
        </Button>
      </div>

      {/* Info Card */}
      <div className="rounded-xl bg-card p-6 shadow-sm ring-1 ring-border/50">
        <h2 className="text-sm font-semibold">Profile Information</h2>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex items-center gap-3 rounded-lg bg-background p-4">
            <div className="flex size-10 items-center justify-center rounded-full bg-secondary">
              <User className="size-4 text-foreground" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Full Name</p>
              <p className="text-sm font-medium">{profile.fullName ?? "—"}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-lg bg-background p-4">
            <div className="flex size-10 items-center justify-center rounded-full bg-secondary">
              <Mail className="size-4 text-foreground" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Email</p>
              <p className="text-sm font-medium">{profile.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-lg bg-background p-4">
            <div className="flex size-10 items-center justify-center rounded-full bg-secondary">
              <Shield className="size-4 text-foreground" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Student ID</p>
              <p className="text-sm font-medium font-mono">{profile.id.slice(0, 8).toUpperCase()}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-lg bg-background p-4">
            <div className="flex size-10 items-center justify-center rounded-full bg-secondary">
              <GraduationCap className="size-4 text-foreground" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Faculty</p>
              <p className="text-sm font-medium">{profile.faculty ?? "—"}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-lg bg-background p-4">
            <div className="flex size-10 items-center justify-center rounded-full bg-secondary">
              <Users className="size-4 text-foreground" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Group</p>
              <p className="text-sm font-medium">{profile.group ?? "—"}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-lg bg-background p-4">
            <div className="flex size-10 items-center justify-center rounded-full bg-secondary">
              <CalendarDays className="size-4 text-foreground" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Joined</p>
              <p className="text-sm font-medium">{formatDate(profile.createdAt)}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-lg bg-background p-4">
            <div className="flex size-10 items-center justify-center rounded-full bg-secondary">
              <Users className="size-4 text-foreground" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Account Status</p>
              <Badge variant={statusBadge.variant} className="mt-0.5 rounded-lg">
                {statusBadge.label}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Bio */}
      {profile.bio && (
        <div className="rounded-xl bg-card p-6 shadow-sm ring-1 ring-border/50">
          <h2 className="text-sm font-semibold">About</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {profile.bio}
          </p>
        </div>
      )}

      {/* Interests */}
      {profile.interests && profile.interests.length > 0 && (
        <div className="rounded-xl bg-card p-6 shadow-sm ring-1 ring-border/50">
          <h2 className="text-sm font-semibold">Interests</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {profile.interests.map((interest) => (
              <Badge key={interest} variant="secondary" className="rounded-lg">
                {interest}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
