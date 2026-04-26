import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { signUpMock, toastErrorMock, toastSuccessMock } = vi.hoisted(() => ({
  signUpMock: vi.fn(),
  toastErrorMock: vi.fn(),
  toastSuccessMock: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="#">{children}</a>,
  createFileRoute: () => (config: Record<string, unknown>) => config,
}));

vi.mock("sonner", () => ({
  toast: {
    error: toastErrorMock,
    success: toastSuccessMock,
  },
}));

vi.mock("@/context/auth", () => ({
  useAuth: vi.fn(() => ({
    signUp: signUpMock,
  })),
}));

describe("register route", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates the registration form before submitting", async () => {
    const { Route } = await import("./register");
    render(<Route.component />);

    await userEvent.type(screen.getByLabelText("Full name"), "A");
    await userEvent.type(screen.getByLabelText("University email"), "user@gmail.com");
    await userEvent.type(screen.getByLabelText("Password"), "short");
    await userEvent.click(screen.getByRole("button", { name: "Register" }));

    expect(await screen.findByText("Name must be at least 2 characters")).toBeInTheDocument();
    expect(screen.getByText("Please use your university email address")).toBeInTheDocument();
    expect(screen.getByText("Faculty or group is required")).toBeInTheDocument();
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("submits a valid registration and shows success feedback", async () => {
    signUpMock.mockResolvedValueOnce({ error: null });

    const { Route } = await import("./register");
    render(<Route.component />);

    await userEvent.type(screen.getByLabelText("Full name"), "Alice Johnson");
    await userEvent.type(screen.getByLabelText("University email"), "alice@example.edu");
    await userEvent.type(screen.getByLabelText("Faculty or group"), "CS-101");
    await userEvent.type(screen.getByLabelText("Password"), "abc12345");
    await userEvent.click(screen.getByRole("button", { name: "Register" }));

    await waitFor(() => {
      expect(signUpMock).toHaveBeenCalledWith("alice@example.edu", "abc12345", {
        full_name: "Alice Johnson",
        group: "CS-101",
      });
    });
    expect(toastSuccessMock).toHaveBeenCalledWith(
      "Registration submitted. Your account is pending administrator approval.",
    );
  });

  it("shows an error toast when registration fails", async () => {
    signUpMock.mockResolvedValueOnce({ error: "Account exists" });

    const { Route } = await import("./register");
    render(<Route.component />);

    await userEvent.type(screen.getByLabelText("Full name"), "Alice Johnson");
    await userEvent.type(screen.getByLabelText("University email"), "alice@example.edu");
    await userEvent.type(screen.getByLabelText("Faculty or group"), "CS-101");
    await userEvent.type(screen.getByLabelText("Password"), "abc12345");
    await userEvent.click(screen.getByRole("button", { name: "Register" }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("Account exists");
    });
  });
});
