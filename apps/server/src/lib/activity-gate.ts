import { count, eq } from "drizzle-orm";
import { db } from "@my-better-t-app/db";
import {
  discussionComments,
  eventRegistrations,
  profiles,
  studentProfiles,
} from "@my-better-t-app/db/schema";

export const requiredProfileFields = [
  "fullName",
  "faculty",
  "group",
  "bio",
  "interests",
] as const;

export type RequiredProfileField = (typeof requiredProfileFields)[number];

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

type ActivityGateProfileRow = {
  role: "admin" | "student";
  fullName: string | null;
  faculty: string | null;
  group: string | null;
  bio: string | null;
  interests: string[] | null;
} | null;

function hasContent(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function isProfileFieldComplete(
  profile: ActivityGateProfileRow,
  field: RequiredProfileField,
): boolean {
  if (!profile) return false;

  switch (field) {
    case "fullName":
      return hasContent(profile.fullName);
    case "faculty":
      return hasContent(profile.faculty);
    case "group":
      return hasContent(profile.group);
    case "bio":
      return hasContent(profile.bio);
    case "interests":
      return Array.isArray(profile.interests) && profile.interests.length > 0;
  }
}

export function buildActivityGate(
  profile: ActivityGateProfileRow,
  commentsPosted: number,
  registeredEventsCount: number,
): ActivityGate {
  const missingRequiredProfileFields = requiredProfileFields.filter(
    (field) => !isProfileFieldComplete(profile, field),
  );

  const isComplete = missingRequiredProfileFields.length === 0;
  const totalFields = requiredProfileFields.length;
  const completedFields = totalFields - missingRequiredProfileFields.length;
  const isStudent = profile?.role !== "admin";

  return {
    profileCompletion: {
      isComplete,
      completedFields,
      totalFields,
      missingRequiredProfileFields,
    },
    commentsPosted,
    personalization: {
      registeredEventsCount,
      permissions: {
        canChangeBackground: isStudent ? registeredEventsCount >= 1 : true,
      },
    },
    permissions: {
      canCommentOnDiscussions: isStudent ? isComplete : true,
      canCreateDiscussions: isStudent ? commentsPosted > 0 : true,
    },
  };
}

export async function getActivityGateForUser(userId: string): Promise<ActivityGate> {
  const [profile, [commentCountRow], [eventRegistrationsRow]] = await Promise.all([
    db
      .select({
        role: profiles.role,
        fullName: profiles.fullName,
        faculty: studentProfiles.faculty,
        group: studentProfiles.group,
        bio: studentProfiles.bio,
        interests: studentProfiles.interests,
      })
      .from(profiles)
      .leftJoin(studentProfiles, eq(profiles.id, studentProfiles.id))
      .where(eq(profiles.id, userId))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db
      .select({ value: count() })
      .from(discussionComments)
      .where(eq(discussionComments.authorId, userId)),
    db
      .select({ value: count() })
      .from(eventRegistrations)
      .where(eq(eventRegistrations.studentId, userId)),
  ]);

  return buildActivityGate(
    profile,
    commentCountRow?.value ?? 0,
    eventRegistrationsRow?.value ?? 0,
  );
}
