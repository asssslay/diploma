import { Link, createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  GraduationCap,
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
type ProfileEndpoint = Client["api"]["profile"][":id"]["$get"];
type ProfileResponse = Extract<
  InferResponseType<ProfileEndpoint>,
  { success: true }
>;
type PublicProfile = ProfileResponse["data"];

export const Route = createFileRoute("/_student/profile_/$profileId")({
  component: PublicProfilePage,
});

function PublicProfilePage() {
  const { profileId } = Route.useParams();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    setIsLoading(true);
    try {
      const api = await getApiClient();
      const res = await api.api.profile[":id"].$get({ param: { id: profileId } });
      if (!res.ok) { toast.error("Failed to load profile"); return; }
      const json = (await res.json()) as ProfileResponse;
      setProfile(json.data);
    } catch { toast.error("Failed to load profile"); }
    finally { setIsLoading(false); }
  }, [profileId]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
        <Skeleton className="h-8 w-16 rounded-lg" />
        <div className="flex items-center gap-5">
          <Skeleton className="size-20 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-8">
        <Link to="/home">
          <Button variant="ghost" size="sm" className="rounded-lg">
            <ArrowLeft className="mr-2 size-4" />
            Back
          </Button>
        </Link>
        <div className="flex flex-col items-center gap-3 py-20">
          <div className="flex size-14 items-center justify-center rounded-full bg-secondary">
            <User className="size-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">Profile not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
      <Link to="/home">
        <Button variant="ghost" size="sm" className="rounded-lg">
          <ArrowLeft className="mr-2 size-4" />
          Back
        </Button>
      </Link>

      {/* Header */}
      <div className="flex items-center gap-5">
        <div className="flex size-20 items-center justify-center rounded-full bg-secondary">
          <User className="size-9 text-muted-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {profile.fullName ?? "Student"}
          </h1>
        </div>
      </div>

      {/* Public Info */}
      <div className="rounded-xl bg-card p-6 shadow-sm ring-1 ring-border/50">
        <h2 className="text-sm font-semibold">Public Information</h2>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
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
