import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  navigateMock,
  signInMock,
  signOutMock,
  toastErrorMock,
} = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  signInMock: vi.fn(),
  signOutMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="#">{children}</a>,
  createFileRoute: () => (config: Record<string, unknown>) => config,
  useNavigate: () => navigateMock,
}));

vi.mock("sonner", () => ({
  toast: {
    error: toastErrorMock,
  },
}));

vi.mock("@/context/auth", () => ({
  useAuth: vi.fn(() => ({
    signIn: signInMock,
    signOut: signOutMock,
  })),
}));

describe("admin login route", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows an error when sign-in fails", async () => {
    signInMock.mockResolvedValueOnce({ error: "Bad credentials" });

    const { Route } = await import("./login");
    render(<Route.component />);

    await userEvent.type(screen.getByLabelText("Admin Email"), "admin@example.edu");
    await userEvent.type(screen.getByLabelText("Password"), "bad-password");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("Bad credentials");
    });
  });

  it("signs out and blocks non-admin users", async () => {
    signInMock.mockResolvedValueOnce({
      error: null,
      profile: { role: "student" },
    });

    const { Route } = await import("./login");
    render(<Route.component />);

    await userEvent.type(screen.getByLabelText("Admin Email"), "admin@example.edu");
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() => {
      expect(signOutMock).toHaveBeenCalledTimes(1);
      expect(toastErrorMock).toHaveBeenCalledWith(
        "Access denied. This login is for administrators only.",
      );
    });
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("navigates to the admin dashboard for admins", async () => {
    signInMock.mockResolvedValueOnce({
      error: null,
      profile: { role: "admin" },
    });

    const { Route } = await import("./login");
    render(<Route.component />);

    await userEvent.type(screen.getByLabelText("Admin Email"), "admin@example.edu");
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({ to: "/admin" });
    });
  });
});
