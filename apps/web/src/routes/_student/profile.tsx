import { createFileRoute } from "@tanstack/react-router";
import type { ChangeEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { User } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getBackgroundGateMessage, type ActivityGate } from "@/lib/activity-gate";
import { getApiClient, readApiErrorResponse } from "@/lib/api";

import { EditProfileDialog } from "./profile/edit-profile-dialog";
import { ParticipationProgressCard } from "./profile/participation-progress-card";
import { ProfileHero } from "./profile/profile-hero";
import { ProfileInfoCard } from "./profile/profile-info-card";
import { uploadProfileAsset } from "./profile/profile-upload";
import type { EditProfileValues, MeResponse, Profile } from "./profile/types";

export const Route = createFileRoute("/_student/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isUploadingBackground, setIsUploadingBackground] = useState(false);

  const fetchProfile = useCallback(async () => {
    setIsLoading(true);
    try {
      const api = await getApiClient();
      const response = await api.api.profile.me.$get();
      if (!response.ok) {
        toast.error("Failed to load profile");
        return;
      }

      const json = (await response.json()) as MeResponse;
      setProfile(json.data);
    } catch {
      toast.error("Failed to load profile");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  async function handleSave(values: EditProfileValues) {
    try {
      const interestsArray = values.interests
        ? values.interests
            .split(",")
            .map((interest) => interest.trim())
            .filter(Boolean)
        : [];

      const api = await getApiClient();
      const response = await api.api.profile.me.$patch({
        json: {
          fullName: values.fullName,
          faculty: values.faculty || null,
          group: values.group || null,
          bio: values.bio || null,
          interests: interestsArray,
        },
      });

      if (!response.ok) {
        toast.error("Failed to update profile");
        return false;
      }

      const json = (await response.json()) as MeResponse;
      setProfile(json.data);
      toast.success("Profile updated");
      return true;
    } catch {
      toast.error("Failed to update profile");
      return false;
    }
  }

  async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploadingAvatar(true);
    try {
      const response = await uploadProfileAsset({
        endpoint: "/api/profile/upload-avatar",
        fieldName: "avatar",
        file,
      });

      if (!response.ok) {
        toast.error("Failed to upload avatar");
        return;
      }

      toast.success("Avatar updated");
      fetchProfile();
    } catch {
      toast.error("Failed to upload avatar");
    } finally {
      setIsUploadingAvatar(false);
      event.target.value = "";
    }
  }

  async function handleBackgroundChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !profile) return;

    setIsUploadingBackground(true);
    try {
      const response = await uploadProfileAsset({
        endpoint: "/api/profile/upload-background",
        fieldName: "background",
        file,
      });

      if (!response.ok) {
        const apiError = await readApiErrorResponse(response);
        if (apiError?.activityGate) {
          setProfile((prev) =>
            prev
              ? { ...prev, activityGate: apiError.activityGate as ActivityGate }
              : prev,
          );
        }
        toast.error(apiError?.error ?? "Failed to upload background");
        return;
      }

      toast.success("Background updated");
      fetchProfile();
    } catch {
      toast.error("Failed to upload background");
    } finally {
      setIsUploadingBackground(false);
      event.target.value = "";
    }
  }

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
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-20 rounded-xl" />
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

  const canChangeBackground =
    profile.activityGate.personalization.permissions.canChangeBackground;
  const registeredEventsCount =
    profile.activityGate.personalization.registeredEventsCount;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
      <ProfileHero
        profile={profile}
        isUploadingAvatar={isUploadingAvatar}
        isUploadingBackground={isUploadingBackground}
        onAvatarChange={handleAvatarChange}
        onBackgroundChange={handleBackgroundChange}
        onEditProfile={() => setEditOpen(true)}
      />

      <div className="-mt-6 rounded-xl border border-border/50 bg-card px-6 py-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Background Personalization</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {getBackgroundGateMessage(profile.activityGate)}
            </p>
          </div>
          <Badge
            variant={canChangeBackground ? "default" : "secondary"}
            className="rounded-lg"
          >
            {registeredEventsCount >= 1 ? "1/1 events" : "0/1 events"}
          </Badge>
        </div>
      </div>

      <ParticipationProgressCard
        profile={profile}
        onCompleteProfile={() => setEditOpen(true)}
      />

      <ProfileInfoCard profile={profile} />

      {profile.bio && (
        <div className="rounded-xl bg-card p-6 shadow-sm ring-1 ring-border/50">
          <h2 className="text-sm font-semibold">About</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {profile.bio}
          </p>
        </div>
      )}

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

      <EditProfileDialog
        open={editOpen}
        profile={profile}
        onOpenChange={setEditOpen}
        onSave={handleSave}
      />
    </div>
  );
}
