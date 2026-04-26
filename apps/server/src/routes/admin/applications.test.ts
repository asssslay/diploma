import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  selectLimitMock,
  selectWhereMock,
  selectInnerJoinSecondMock,
  selectInnerJoinFirstMock,
  selectFromMock,
  selectMock,
  txUpdateWhereMock,
  txUpdateSetMock,
  transactionMock,
  sendEmailMock,
} = vi.hoisted(() => {
  const selectLimitMock = vi.fn();
  const selectWhereMock = vi.fn(() => ({ limit: selectLimitMock }));
  const selectInnerJoinSecondMock = vi.fn(() => ({ where: selectWhereMock }));
  const selectInnerJoinFirstMock = vi.fn(() => ({
    innerJoin: selectInnerJoinSecondMock,
    where: selectWhereMock,
  }));
  const selectFromMock = vi.fn(() => ({ innerJoin: selectInnerJoinFirstMock }));
  const selectMock = vi.fn(() => ({ from: selectFromMock }));

  const txUpdateWhereMock = vi.fn();
  const txUpdateSetMock = vi.fn(() => ({ where: txUpdateWhereMock }));
  const transactionMock = vi.fn();

  return {
    selectLimitMock,
    selectWhereMock,
    selectInnerJoinSecondMock,
    selectInnerJoinFirstMock,
    selectFromMock,
    selectMock,
    txUpdateWhereMock,
    txUpdateSetMock,
    transactionMock,
    sendEmailMock: vi.fn(),
  };
});

vi.mock("@my-better-t-app/db", () => ({
  db: {
    select: selectMock,
    transaction: transactionMock,
  },
}));

vi.mock("@/middleware/auth", async () => {
  const { createAppMiddleware } = await import("@/lib/app");
  return {
    auth: createAppMiddleware(async (_c, next) => {
      await next();
    }),
    adminOnly: createAppMiddleware(async (c, next) => {
      c.set("profile", { id: "admin-1", role: "admin", status: "approved" });
      await next();
    }),
  };
});

vi.mock("@/lib/emails", () => ({
  accountApprovedEmail: vi.fn(() => ({ subject: "approved", html: "<p>approved</p>" })),
  accountRejectedEmail: vi.fn(() => ({ subject: "rejected", html: "<p>rejected</p>" })),
  sendEmail: sendEmailMock,
}));

import app from "./applications";

const applicationId = "22222222-2222-4222-8222-222222222222";

describe("admin applications routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transactionMock.mockImplementation(async (callback: (tx: { update: () => { set: typeof txUpdateSetMock } }) => Promise<void>) => {
      await callback({
        update: () => ({ set: txUpdateSetMock }),
      });
    });
    txUpdateWhereMock.mockResolvedValue(undefined);
    sendEmailMock.mockResolvedValue(undefined);
  });

  it("approves pending applications and sends the email asynchronously", async () => {
    selectLimitMock.mockResolvedValueOnce([
      {
        id: "student-1",
        status: "pending",
        email: "student@example.com",
        fullName: "Student",
      },
    ]);

    const response = await app.request(`http://localhost/${applicationId}/approve`, {
      method: "PATCH",
    });

    expect(response.status).toBe(200);
    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock).toHaveBeenCalledWith(
      "student@example.com",
      expect.any(Object),
    );
  });

  it("rejects already reviewed applications with conflict", async () => {
    selectLimitMock.mockResolvedValueOnce([
      {
        id: "student-1",
        status: "approved",
        email: "student@example.com",
        fullName: "Student",
      },
    ]);

    const response = await app.request(`http://localhost/${applicationId}/approve`, {
      method: "PATCH",
    });

    expect(response.status).toBe(409);
    await expect(response.text()).resolves.toContain(
      "Application is already approved",
    );
  });

  it("returns 404 for missing applications", async () => {
    selectLimitMock.mockResolvedValueOnce([]);

    const response = await app.request(`http://localhost/${applicationId}/approve`, {
      method: "PATCH",
    });

    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toContain("Application not found");
  });

  it("rejects pending applications and does not fail the request when email sending rejects", async () => {
    selectLimitMock.mockResolvedValueOnce([
      {
        id: "student-1",
        status: "pending",
        email: "student@example.com",
        fullName: "Student",
      },
    ]);
    sendEmailMock.mockRejectedValueOnce(new Error("email failed"));

    const response = await app.request(`http://localhost/${applicationId}/reject`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: "Incomplete information" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: { id: applicationId, status: "rejected" },
    });
  });
});
