import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./auth";

const {
  getSessionMock,
  onAuthStateChangeMock,
  signInWithPasswordMock,
  signUpMock,
  signOutMock,
  profileSingleMock,
  profileEqMock,
  profileSelectMock,
  fromMock,
} = vi.hoisted(() => {
  const profileSingleMock = vi.fn();
  const profileEqMock = vi.fn(() => ({ single: profileSingleMock }));
  const profileSelectMock = vi.fn(() => ({ eq: profileEqMock }));
  const fromMock = vi.fn(() => ({ select: profileSelectMock }));

  return {
    getSessionMock: vi.fn(),
    onAuthStateChangeMock: vi.fn(),
    signInWithPasswordMock: vi.fn(),
    signUpMock: vi.fn(),
    signOutMock: vi.fn(),
    profileSingleMock,
    profileEqMock,
    profileSelectMock,
    fromMock,
  };
});

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: getSessionMock,
      onAuthStateChange: onAuthStateChangeMock,
      signInWithPassword: signInWithPasswordMock,
      signUp: signUpMock,
      signOut: signOutMock,
    },
    from: fromMock,
  },
}));

function Consumer() {
  const auth = useAuth();

  return (
    <div>
      <div data-testid="loading">{String(auth.isLoading)}</div>
      <div data-testid="user">{auth.user?.id ?? "none"}</div>
      <div data-testid="role">{auth.profile?.role ?? "none"}</div>
      <button
        type="button"
        onClick={() => void auth.signIn("user@example.com", "password")}
      >
        Sign In
      </button>
      <button
        type="button"
        onClick={() => void auth.signOut()}
      >
        Sign Out
      </button>
    </div>
  );
}

describe("AuthProvider", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    onAuthStateChangeMock.mockReturnValue({
      data: {
        subscription: {
          unsubscribe: vi.fn(),
        },
      },
    });
  });

  it("hydrates session and profile state on mount", async () => {
    getSessionMock.mockResolvedValue({
      data: {
        session: {
          user: { id: "user-1" },
        },
      },
    });
    profileSingleMock.mockResolvedValue({
      data: {
        role: "student",
        status: "approved",
        full_name: "User One",
        student_applications: [],
      },
    });

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("false");
    });
    expect(screen.getByTestId("user")).toHaveTextContent("user-1");
    expect(screen.getByTestId("role")).toHaveTextContent("student");
  });

  it("returns profile data on successful sign in", async () => {
    getSessionMock.mockResolvedValue({
      data: { session: null },
    });
    signInWithPasswordMock.mockResolvedValue({
      data: { user: { id: "user-2" } },
      error: null,
    });
    profileSingleMock.mockResolvedValue({
      data: {
        role: "student",
        status: "approved",
        full_name: "User Two",
        student_applications: [],
      },
      error: null,
    });

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("false");
    });

    await userEvent.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() => {
      expect(signInWithPasswordMock).toHaveBeenCalledWith({
        email: "user@example.com",
        password: "password",
      });
    });
    expect(screen.getByTestId("role")).toHaveTextContent("student");
  });

  it("clears profile state on sign out", async () => {
    getSessionMock.mockResolvedValue({
      data: {
        session: {
          user: { id: "user-1" },
        },
      },
    });
    profileSingleMock.mockResolvedValue({
      data: {
        role: "student",
        status: "approved",
        full_name: "User One",
        student_applications: [],
      },
    });
    signOutMock.mockResolvedValue({ error: null });

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("role")).toHaveTextContent("student");
    });

    await userEvent.click(screen.getByRole("button", { name: "Sign Out" }));

    await waitFor(() => {
      expect(screen.getByTestId("role")).toHaveTextContent("none");
    });
  });
});
