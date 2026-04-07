import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  CalendarDays,
  Camera,
  GraduationCap,
  Mail,
  Pencil,
  Shield,
  Trash2,
  User,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import type { InferResponseType } from "hono/client";
import { hc } from "hono/client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/utils";
import { getApiClient } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { env } from "@my-better-t-app/env/web";
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

const editSchema = z.object({
  fullName: z.string().min(1, { message: "Name is required" }).max(100),
  faculty: z.string().max(200).optional(),
  group: z.string().max(200).optional(),
  bio: z.string().max(1000).optional(),
  interests: z.string().optional(),
});

type FieldErrors = Partial<Record<keyof z.infer<typeof editSchema>, string>>;

function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [faculty, setFaculty] = useState("");
  const [group, setGroup] = useState("");
  const [bio, setBio] = useState("");
  const [interests, setInterests] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Avatar
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

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

  function openEditDialog() {
    if (!profile) return;
    setFullName(profile.fullName ?? "");
    setFaculty(profile.faculty ?? "");
    setGroup(profile.group ?? "");
    setBio(profile.bio ?? "");
    setInterests((profile.interests ?? []).join(", "));
    setErrors({});
    setEditOpen(true);
  }

  async function handleSave() {
    const result = editSchema.safeParse({ fullName, faculty, group, bio, interests });
    if (!result.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof FieldErrors;
        if (!fieldErrors[field]) fieldErrors[field] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      const interestsArray = result.data.interests
        ? result.data.interests.split(",").map((s) => s.trim()).filter(Boolean)
        : [];

      const api = await getApiClient();
      const res = await api.api.profile.me.$patch({
        json: {
          fullName: result.data.fullName,
          faculty: result.data.faculty || null,
          group: result.data.group || null,
          bio: result.data.bio || null,
          interests: interestsArray,
        },
      });

      if (!res.ok) { toast.error("Failed to update profile"); return; }

      const json = (await res.json()) as MeResponse;
      setProfile(json.data);
      toast.success("Profile updated");
      setEditOpen(false);
    } catch { toast.error("Failed to update profile"); }
    finally { setIsSubmitting(false); }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingAvatar(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const formData = new FormData();
      formData.append("avatar", file);

      const uploadRes = await fetch(
        `${env.VITE_SERVER_URL}/api/profile/upload-avatar`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session?.access_token}` },
          body: formData,
        },
      );

      if (!uploadRes.ok) { toast.error("Failed to upload avatar"); return; }

      toast.success("Avatar updated");
      fetchProfile();
    } catch { toast.error("Failed to upload avatar"); }
    finally { setIsUploadingAvatar(false); }
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
          <div className="group relative">
            {profile.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt={profile.fullName ?? "Avatar"}
                className="size-20 rounded-full object-cover"
              />
            ) : (
              <div className="flex size-20 items-center justify-center rounded-full bg-accent">
                <User className="size-9 text-accent-foreground" />
              </div>
            )}
            <label className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-foreground/0 transition-colors group-hover:bg-foreground/40">
              <Camera className="size-5 text-background opacity-0 transition-opacity group-hover:opacity-100" />
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleAvatarChange}
                disabled={isUploadingAvatar}
              />
            </label>
            <label className="absolute -bottom-0.5 -right-0.5 flex size-7 cursor-pointer items-center justify-center rounded-full bg-secondary text-muted-foreground shadow-sm ring-1 ring-border/50 transition-colors hover:bg-secondary/80">
              <Camera className="size-3.5" />
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleAvatarChange}
                disabled={isUploadingAvatar}
              />
            </label>
            {isUploadingAvatar && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-foreground/40">
                <div className="size-5 animate-spin rounded-full border-2 border-background border-t-transparent" />
              </div>
            )}
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
        <Button variant="outline" className="rounded-lg gap-2" onClick={openEditDialog}>
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
              <Shield className="size-4 text-foreground" />
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

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={(open) => { setEditOpen(open); if (!open) setErrors({}); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
            <DialogDescription>
              Update your profile information. Email, Student ID, and join date cannot be changed.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Full Name</Label>
              <Input
                id="edit-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="rounded-lg bg-background"
              />
              {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-faculty">Faculty</Label>
                <Input
                  id="edit-faculty"
                  value={faculty}
                  onChange={(e) => setFaculty(e.target.value)}
                  placeholder="e.g. Computer Science"
                  className="rounded-lg bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-group">Group</Label>
                <Input
                  id="edit-group"
                  value={group}
                  onChange={(e) => setGroup(e.target.value)}
                  placeholder="e.g. CS-101"
                  className="rounded-lg bg-background"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-bio">Bio</Label>
              <Textarea
                id="edit-bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell us about yourself..."
                rows={3}
                className="rounded-lg bg-background"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-interests">Interests</Label>
              <Input
                id="edit-interests"
                value={interests}
                onChange={(e) => setInterests(e.target.value)}
                placeholder="e.g. Programming, Design, Music"
                className="rounded-lg bg-background"
              />
              <p className="text-xs text-muted-foreground">Separate with commas</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" className="rounded-lg" onClick={() => setEditOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button className="rounded-lg" onClick={handleSave} disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
