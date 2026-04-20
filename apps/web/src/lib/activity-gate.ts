export type RequiredProfileField =
  | "fullName"
  | "faculty"
  | "group"
  | "bio"
  | "interests";

export type ActivityGate = {
  profileCompletion: {
    isComplete: boolean;
    completedFields: number;
    totalFields: number;
    missingRequiredProfileFields: RequiredProfileField[];
  };
  commentsPosted: number;
  personalization: {
    registeredEventsCount: number;
    permissions: {
      canChangeBackground: boolean;
    };
  };
  permissions: {
    canCommentOnDiscussions: boolean;
    canCreateDiscussions: boolean;
  };
};

const REQUIRED_PROFILE_FIELD_LABELS: Record<RequiredProfileField, string> = {
  fullName: "Full name",
  faculty: "Faculty",
  group: "Group",
  bio: "Bio",
  interests: "At least one interest",
};

export function getRequiredProfileFieldLabel(
  field: RequiredProfileField,
): string {
  return REQUIRED_PROFILE_FIELD_LABELS[field];
}

export function getMissingProfileFieldLabels(
  fields: readonly RequiredProfileField[],
): string[] {
  return fields.map(getRequiredProfileFieldLabel);
}

export function getCommentGateMessage(activityGate: ActivityGate): string {
  if (activityGate.permissions.canCommentOnDiscussions) {
    return "Discussion comments are unlocked.";
  }

  const missingFields = getMissingProfileFieldLabels(
    activityGate.profileCompletion.missingRequiredProfileFields,
  );

  return `Complete your profile to unlock comments. Missing: ${missingFields.join(", ")}.`;
}

export function getDiscussionGateMessage(activityGate: ActivityGate): string {
  if (activityGate.permissions.canCreateDiscussions) {
    return "Discussion creation is unlocked.";
  }

  const commentProgress = Math.min(activityGate.commentsPosted, 1);
  const progressMessage = `Post 1 comment to unlock discussions (${commentProgress}/1).`;

  if (activityGate.permissions.canCommentOnDiscussions) {
    return progressMessage;
  }

  return `${progressMessage} Complete your profile first so you can comment.`;
}

export function getBackgroundGateMessage(activityGate: ActivityGate): string {
  if (activityGate.personalization.permissions.canChangeBackground) {
    return "Profile background customization is unlocked.";
  }

  const progress = Math.min(activityGate.personalization.registeredEventsCount, 1);
  return `Register for 1 event to unlock profile backgrounds (${progress}/1).`;
}
