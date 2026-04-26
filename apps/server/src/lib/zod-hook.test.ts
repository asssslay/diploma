import { describe, expect, it, vi } from "vitest";
import { validationHook } from "./zod-hook";

describe("validationHook", () => {
  it("returns a 422 json payload for zod validation failures", () => {
    const jsonMock = vi.fn();

    const response = validationHook(
      {
        success: false,
        error: {
          issues: [{ path: ["field"], message: "Required" }],
        },
      } as never,
      { json: jsonMock } as never,
    );

    expect(jsonMock).toHaveBeenCalledWith(
      {
        success: false,
        error: [{ path: ["field"], message: "Required" }],
      },
      422,
    );
    expect(response).toBeUndefined();
  });
});
