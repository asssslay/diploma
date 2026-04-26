import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getProfileMock, toastErrorMock } = vi.hoisted(() => ({
  getProfileMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="#">{children}</a>,
  createFileRoute: () => (config: Record<string, unknown>) => ({
    ...config,
    useParams: () => ({ profileId: "profile-1" }),
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: toastErrorMock,
  },
}));

vi.mock("@/lib/api", () => ({
  getApiClient: vi.fn(async () => ({
    api: {
      profile: {
        ":id": {
          $get: getProfileMock,
        },
      },
    },
  })),
}));

const fullProfileResponse = {
  success: true as const,
  data: {
    id: "profile-1",
    fullName: "Alice Johnson",
    faculty: "Computer Science",
    group: "CS-101",
    bio: "Enjoys distributed systems.",
    interests: ["AI", "Databases"],
    avatarUrl: "https://cdn.example.com/avatar.png",
    backgroundUrl: "https://cdn.example.com/background.png",
    createdAt: "2030-05-01T12:00:00.000Z",
  },
};

describe("public profile route", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the not-found state when loading fails", async () => {
    getProfileMock.mockResolvedValueOnce({ ok: false });

    const { Route } = await import("./profile_.$profileId");
    render(<Route.component />);

    expect(await screen.findByText("Profile not found.")).toBeInTheDocument();
    expect(toastErrorMock).toHaveBeenCalledWith("Failed to load profile");
  });

  it("renders public profile sections with avatar, background, and interests", async () => {
    getProfileMock.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue(fullProfileResponse),
    });

    const { Route } = await import("./profile_.$profileId");
    const { container } = render(<Route.component />);

    expect(await screen.findByText("Alice Johnson")).toBeInTheDocument();
    expect(screen.getByText("Computer Science")).toBeInTheDocument();
    expect(screen.getByText("Enjoys distributed systems.")).toBeInTheDocument();
    expect(screen.getByText("AI")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Alice Johnson" })).toHaveAttribute(
      "src",
      "https://cdn.example.com/avatar.png",
    );
    expect(container.querySelector('[style*="background.png"]')).not.toBeNull();
  });

  it("falls back to the default avatar when no avatar image is available", async () => {
    getProfileMock.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({
        ...fullProfileResponse,
        data: {
          ...fullProfileResponse.data,
          avatarUrl: null,
          bio: null,
          interests: [],
          backgroundUrl: null,
        },
      }),
    });

    const { Route } = await import("./profile_.$profileId");
    render(<Route.component />);

    expect(await screen.findByText("Alice Johnson")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Alice Johnson" })).not.toBeInTheDocument();
    expect(screen.queryByText("About")).not.toBeInTheDocument();
    expect(screen.queryByText("Interests")).not.toBeInTheDocument();
  });
});
