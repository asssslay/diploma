import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getCommentGateMessage,
  getDiscussionGateMessage,
  getMissingProfileFieldLabels,
} from "@/lib/activity-gate";

import type { Profile } from "./types";

type ParticipationProgressCardProps = {
  profile: Profile;
  onCompleteProfile: () => void;
};

export function ParticipationProgressCard({
  profile,
  onCompleteProfile,
}: ParticipationProgressCardProps) {
  const { activityGate } = profile;
  const missingFields = getMissingProfileFieldLabels(
    activityGate.profileCompletion.missingRequiredProfileFields,
  );
  const profileCompletionPercent =
    (activityGate.profileCompletion.completedFields /
      activityGate.profileCompletion.totalFields) *
    100;

  return (
    <div className="rounded-xl bg-card p-6 shadow-sm ring-1 ring-border/50">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold">Participation Progress</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Complete your profile and join discussions to unlock more
            participation features.
          </p>
        </div>
        {!activityGate.profileCompletion.isComplete && (
          <Button
            variant="outline"
            className="rounded-lg"
            onClick={onCompleteProfile}
          >
            Complete Profile
          </Button>
        )}
      </div>

      <div className="mt-5 space-y-5">
        <div className="rounded-lg bg-background p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Profile completion</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {activityGate.profileCompletion.completedFields}/
                {activityGate.profileCompletion.totalFields} required fields
                completed
              </p>
            </div>
            <Badge
              variant={
                activityGate.profileCompletion.isComplete
                  ? "default"
                  : "secondary"
              }
              className="rounded-lg"
            >
              {activityGate.profileCompletion.isComplete
                ? "Complete"
                : "In Progress"}
            </Badge>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${profileCompletionPercent}%` }}
            />
          </div>
          {missingFields.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {missingFields.map((field) => (
                <Badge key={field} variant="outline" className="rounded-lg">
                  {field}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg bg-background p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">Comment on discussions</p>
              <Badge
                variant={
                  activityGate.permissions.canCommentOnDiscussions
                    ? "default"
                    : "secondary"
                }
                className="rounded-lg"
              >
                {activityGate.permissions.canCommentOnDiscussions
                  ? "Unlocked"
                  : "Locked"}
              </Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {getCommentGateMessage(activityGate)}
            </p>
          </div>

          <div className="rounded-lg bg-background p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">Create discussions</p>
              <Badge
                variant={
                  activityGate.permissions.canCreateDiscussions
                    ? "default"
                    : "secondary"
                }
                className="rounded-lg"
              >
                {activityGate.permissions.canCreateDiscussions
                  ? "Unlocked"
                  : "Locked"}
              </Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {getDiscussionGateMessage(activityGate)}
            </p>
            <p className="mt-2 text-xs text-muted-foreground/80">
              Comments posted: {activityGate.commentsPosted}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
