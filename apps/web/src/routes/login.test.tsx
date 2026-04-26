import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { navigateMock, signInMock, toastErrorMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  signInMock: vi.fn(),
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
  })),
}));

describe("student login route", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("navigates to home after a successful login", async () => {
    signInMock.mockResolvedValueOnce({ error: null });

    const { Route } = await import("./login");
    render(<Route.component />);

    await userEvent.type(screen.getByLabelText("Email"), "student@example.edu");
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() => {
      expect(signInMock).toHaveBeenCalledWith(
        "student@example.edu",
        "password123",
      );
    });
    expect(navigateMock).toHaveBeenCalledWith({ to: "/home" });
  });

  it("shows a toast when login fails", async () => {
    signInMock.mockResolvedValueOnce({ error: "Invalid credentials" });

    const { Route } = await import("./login");
    render(<Route.component />);

    await userEvent.type(screen.getByLabelText("Email"), "student@example.edu");
    await userEvent.type(screen.getByLabelText("Password"), "bad-password");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("Invalid credentials");
    });
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
