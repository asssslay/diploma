import { describe, expect, it, vi } from "vitest";

vi.mock("@my-better-t-app/db", () => ({
  db: {},
}));

const { buildActivityGate } = await import("./activity-gate");

describe("buildActivityGate", () => {
  it("marks a student profile as complete when all required fields are present", () => {
    const gate = buildActivityGate(
      {
        role: "student",
        fullName: "Ada Lovelace",
        faculty: "CS",
        group: "CS-101",
        bio: "Writes code",
        interests: ["math"],
      },
      1,
      1,
    );

    expect(gate.profileCompletion.isComplete).toBe(true);
    expect(gate.profileCompletion.completedFields).toBe(5);
    expect(gate.profileCompletion.missingRequiredProfileFields).toEqual([]);
    expect(gate.permissions.canCommentOnDiscussions).toBe(true);
    expect(gate.permissions.canCreateDiscussions).toBe(true);
    expect(gate.personalization.permissions.canChangeBackground).toBe(true);
  });

  it("tracks missing required fields and locked permissions for students", () => {
    const gate = buildActivityGate(
      {
        role: "student",
        fullName: "  ",
        faculty: null,
        group: "CS-101",
        bio: null,
        interests: [],
      },
      0,
      0,
    );

    expect(gate.profileCompletion.isComplete).toBe(false);
    expect(gate.profileCompletion.missingRequiredProfileFields).toEqual([
      "fullName",
      "faculty",
      "bio",
      "interests",
    ]);
    expect(gate.permissions.canCommentOnDiscussions).toBe(false);
    expect(gate.permissions.canCreateDiscussions).toBe(false);
    expect(gate.personalization.permissions.canChangeBackground).toBe(false);
  });

  it("keeps admin permissions unlocked regardless of profile state", () => {
    const gate = buildActivityGate(
      {
        role: "admin",
        fullName: null,
        faculty: null,
        group: null,
        bio: null,
        interests: null,
      },
      0,
      0,
    );

    expect(gate.permissions.canCommentOnDiscussions).toBe(true);
    expect(gate.permissions.canCreateDiscussions).toBe(true);
    expect(gate.personalization.permissions.canChangeBackground).toBe(true);
  });

  it.each([
    ["fullName", { fullName: " " }],
    ["faculty", { faculty: null }],
    ["group", { group: " " }],
    ["bio", { bio: "" }],
    ["interests", { interests: [] }],
  ] as const)(
    "marks %s as missing when its completeness rule fails",
    (field, overrides) => {
      const gate = buildActivityGate(
        {
          role: "student",
          fullName: "Ada Lovelace",
          faculty: "CS",
          group: "CS-101",
          bio: "Writes code",
          interests: ["math"],
          ...overrides,
        },
        1,
        1,
      );

      expect(gate.profileCompletion.missingRequiredProfileFields).toEqual([field]);
    },
  );
});
