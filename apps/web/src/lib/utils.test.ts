import { describe, expect, it } from "vitest";
import { formatDate, formatTime, isEdited } from "./utils";

describe("utils helpers", () => {
  it("formats dates in day-month-year order", () => {
    expect(formatDate("2030-06-01T12:34:00.000Z")).toBe("01/06/2030");
  });

  it("formats utc times with hour and minute", () => {
    expect(formatTime("2030-06-01T12:34:00.000Z")).toBe("12:34 PM");
  });

  it("treats updates over one minute apart as edited", () => {
    expect(
      isEdited("2030-06-01T12:00:00.000Z", "2030-06-01T12:01:01.000Z"),
    ).toBe(true);
    expect(
      isEdited("2030-06-01T12:00:00.000Z", "2030-06-01T12:00:30.000Z"),
    ).toBe(false);
  });
});
