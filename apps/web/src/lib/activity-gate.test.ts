import { describe, expect, it } from "vitest";
import {
  getBackgroundGateMessage,
  getCommentGateMessage,
  getDiscussionGateMessage,
  getMissingProfileFieldLabels,
  getRequiredProfileFieldLabel,
  type ActivityGate,
} from "./activity-gate";

const lockedGate: ActivityGate = {
  profileCompletion: {
    isComplete: false,
    completedFields: 2,
    totalFields: 5,
    missingRequiredProfileFields: ["fullName", "bio"],
  },
  commentsPosted: 0,
  personalization: {
    registeredEventsCount: 0,
    permissions: {
      canChangeBackground: false,
    },
  },
  permissions: {
    canCommentOnDiscussions: false,
    canCreateDiscussions: false,
  },
};

describe("web activity gate helpers", () => {
  it("maps required profile fields to labels", () => {
    expect(getRequiredProfileFieldLabel("interests")).toBe("At least one interest");
    expect(getMissingProfileFieldLabels(["fullName", "bio"])).toEqual([
      "Full name",
      "Bio",
    ]);
  });

  it("builds the correct locked messages", () => {
    expect(getCommentGateMessage(lockedGate)).toContain(
      "Complete your profile to unlock comments",
    );
    expect(getDiscussionGateMessage(lockedGate)).toContain(
      "Post 1 comment to unlock discussions",
    );
    expect(getBackgroundGateMessage(lockedGate)).toContain(
      "Register for 1 event to unlock profile backgrounds",
    );
  });

  it("builds the correct unlocked messages", () => {
    const unlockedGate: ActivityGate = {
      ...lockedGate,
      profileCompletion: {
        ...lockedGate.profileCompletion,
        isComplete: true,
        missingRequiredProfileFields: [],
      },
      commentsPosted: 1,
      personalization: {
        registeredEventsCount: 1,
        permissions: { canChangeBackground: true },
      },
      permissions: {
        canCommentOnDiscussions: true,
        canCreateDiscussions: true,
      },
    };

    expect(getCommentGateMessage(unlockedGate)).toBe(
      "Discussion comments are unlocked.",
    );
    expect(getDiscussionGateMessage(unlockedGate)).toBe(
      "Discussion creation is unlocked.",
    );
    expect(getBackgroundGateMessage(unlockedGate)).toBe(
      "Profile background customization is unlocked.",
    );
  });
});
