import { useEffect, useState } from "react";

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
import { Textarea } from "@/components/ui/textarea";

import {
  type EditFieldErrors,
  type EditProfileValues,
  editSchema,
  type Profile,
} from "./types";

type EditProfileDialogProps = {
  open: boolean;
  profile: Profile;
  onOpenChange: (open: boolean) => void;
  onSave: (values: EditProfileValues) => Promise<boolean>;
};

export function EditProfileDialog({
  open,
  profile,
  onOpenChange,
  onSave,
}: EditProfileDialogProps) {
  const [fullName, setFullName] = useState("");
  const [faculty, setFaculty] = useState("");
  const [group, setGroup] = useState("");
  const [bio, setBio] = useState("");
  const [interests, setInterests] = useState("");
  const [errors, setErrors] = useState<EditFieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;

    setFullName(profile.fullName ?? "");
    setFaculty(profile.faculty ?? "");
    setGroup(profile.group ?? "");
    setBio(profile.bio ?? "");
    setInterests((profile.interests ?? []).join(", "));
    setErrors({});
  }, [open, profile]);

  async function handleSave() {
    const result = editSchema.safeParse({
      fullName,
      faculty,
      group,
      bio,
      interests,
    });
    if (!result.success) {
      const fieldErrors: EditFieldErrors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof EditFieldErrors;
        if (!fieldErrors[field]) fieldErrors[field] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);
    try {
      const didSave = await onSave(result.data);
      if (didSave) {
        onOpenChange(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) setErrors({});
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogDescription>
            Update your profile information. Email, Student ID, and join date
            cannot be changed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Full Name</Label>
            <Input
              id="edit-name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              className="rounded-lg bg-background"
            />
            {errors.fullName && (
              <p className="text-xs text-destructive">{errors.fullName}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-faculty">Faculty</Label>
              <Input
                id="edit-faculty"
                value={faculty}
                onChange={(event) => setFaculty(event.target.value)}
                placeholder="e.g. Computer Science"
                className="rounded-lg bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-group">Group</Label>
              <Input
                id="edit-group"
                value={group}
                onChange={(event) => setGroup(event.target.value)}
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
              onChange={(event) => setBio(event.target.value)}
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
              onChange={(event) => setInterests(event.target.value)}
              placeholder="e.g. Programming, Design, Music"
              className="rounded-lg bg-background"
            />
            <p className="text-xs text-muted-foreground">Separate with commas</p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="rounded-lg"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            className="rounded-lg"
            onClick={handleSave}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
