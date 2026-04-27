import type { ChangeEventHandler } from "react";
import { Camera, Pencil, User } from "lucide-react";

import { Button } from "@/components/ui/button";

import type { Profile } from "./types";

type ProfileHeroProps = {
  profile: Profile;
  isUploadingAvatar: boolean;
  isUploadingBackground: boolean;
  onAvatarChange: ChangeEventHandler<HTMLInputElement>;
  onBackgroundChange: ChangeEventHandler<HTMLInputElement>;
  onEditProfile: () => void;
};

const BACKGROUND_INPUT_ID = "profile-background-input";
const AVATAR_INPUT_ID = "profile-avatar-input";

export function ProfileHero({
  profile,
  isUploadingAvatar,
  isUploadingBackground,
  onAvatarChange,
  onBackgroundChange,
  onEditProfile,
}: ProfileHeroProps) {
  const canChangeBackground =
    profile.activityGate.personalization.permissions.canChangeBackground;

  return (
    <div className="overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-border/50">
      <div
        className="relative h-44 bg-linear-to-br from-accent/40 via-secondary to-background"
        style={
          profile.backgroundUrl
            ? {
                backgroundImage: `linear-gradient(to bottom, rgba(255, 255, 255, 0.18), rgba(226, 232, 240, 0.08)), url(${profile.backgroundUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundBlendMode: "soft-light",
              }
            : undefined
        }
      >
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white/18 via-white/8 to-transparent" />
        <div className="pointer-events-none absolute bottom-4 left-6 h-28 w-[22rem] rounded-full bg-white/26 blur-3xl" />
        <div className="absolute right-4 top-4 flex items-center gap-2">
          <label
            htmlFor={BACKGROUND_INPUT_ID}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium backdrop-blur ${
              canChangeBackground
                ? "cursor-pointer border-border/60 bg-background/80 text-foreground hover:bg-background"
                : "cursor-not-allowed border-border/40 bg-background/60 text-muted-foreground"
            }`}
          >
            <Camera className="size-4" />
            {isUploadingBackground ? "Uploading..." : "Change Background"}
          </label>
          <input
            id={BACKGROUND_INPUT_ID}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={onBackgroundChange}
            disabled={isUploadingBackground || !canChangeBackground}
          />
        </div>

        <div className="absolute inset-x-0 bottom-0 p-6">
          <div className="flex items-end justify-between gap-4">
            <div className="flex items-center gap-5">
              <div className="group relative">
                {profile.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt={profile.fullName ?? "Avatar"}
                    className="size-20 rounded-full border-2 border-background object-cover shadow-sm"
                  />
                ) : (
                  <div className="flex size-20 items-center justify-center rounded-full border-2 border-background bg-accent shadow-sm">
                    <User className="size-9 text-accent-foreground" />
                  </div>
                )}
                <label
                  htmlFor={AVATAR_INPUT_ID}
                  className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-foreground/0 transition-colors group-hover:bg-foreground/40"
                >
                  <Camera className="size-5 text-background opacity-0 transition-opacity group-hover:opacity-100" />
                </label>
                <label
                  htmlFor={AVATAR_INPUT_ID}
                  className="absolute -bottom-0.5 -right-0.5 flex size-7 cursor-pointer items-center justify-center rounded-full bg-secondary text-muted-foreground shadow-sm ring-1 ring-border/50 transition-colors hover:bg-secondary/80"
                >
                  <Camera className="size-3.5" />
                </label>
                <input
                  id={AVATAR_INPUT_ID}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={onAvatarChange}
                  disabled={isUploadingAvatar}
                />
                {isUploadingAvatar && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-foreground/40">
                    <div className="size-5 animate-spin rounded-full border-2 border-background border-t-transparent" />
                  </div>
                )}
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white drop-shadow-sm">
                  {profile.fullName ?? "Student"}
                </h1>
                <p className="mt-0.5 text-sm text-white/90 drop-shadow-xs">
                  {profile.email}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              className="gap-2 rounded-lg border-background/50 bg-background/80 backdrop-blur hover:bg-background"
              onClick={onEditProfile}
            >
              <Pencil className="size-4" />
              Edit Profile
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
