import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  getProfileMock,
  patchProfileMock,
  getSessionMock,
  readApiErrorResponseMock,
  toastErrorMock,
  toastSuccessMock,
} = vi.hoisted(() => ({
  getProfileMock: vi.fn(),
  patchProfileMock: vi.fn(),
  getSessionMock: vi.fn(),
  readApiErrorResponseMock: vi.fn(),
  toastErrorMock: vi.fn(),
  toastSuccessMock: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (config: Record<string, unknown>) => config,
}));

vi.mock("sonner", () => ({
  toast: {
    error: toastErrorMock,
    success: toastSuccessMock,
  },
}));

vi.mock("@/lib/api", () => ({
  getApiClient: vi.fn(async () => ({
    api: {
      profile: {
        me: {
          $get: getProfileMock,
          $patch: patchProfileMock,
        },
      },
    },
  })),
  readApiErrorResponse: readApiErrorResponseMock,
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: getSessionMock,
    },
  },
}));

vi.mock("@my-better-t-app/env/web", () => ({
  env: {
    VITE_SERVER_URL: "https://server.example.com",
  },
}));

const baseProfile = {
  id: "user-1",
  fullName: "Ada Lovelace",
  email: "ada@example.com",
  faculty: "Computer Science",
  group: "CS-101",
  bio: "First programmer",
  interests: ["Math"],
  avatarUrl: null,
  backgroundUrl: null,
  createdAt: "2030-01-01T12:00:00.000Z",
  status: "approved" as const,
  activityGate: {
    profileCompletion: {
      isComplete: true,
      completedFields: 5,
      totalFields: 5,
      missingRequiredProfileFields: [],
    },
    commentsPosted: 1,
    personalization: {
      registeredEventsCount: 0,
      permissions: { canChangeBackground: false },
    },
    permissions: {
      canCommentOnDiscussions: true,
      canCreateDiscussions: true,
    },
  },
};

describe("profile route", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    getSessionMock.mockResolvedValue({
      data: {
        session: {
          access_token: "token-123",
        },
      },
    });
  });

  it("shows the not-found state when profile loading fails", async () => {
    getProfileMock.mockResolvedValue({
      ok: false,
      json: vi.fn(),
    });

    const { Route } = await import("./profile");
    render(<Route.component />);

    expect(await screen.findByText("Profile not found.")).toBeInTheDocument();
    expect(toastErrorMock).toHaveBeenCalledWith("Failed to load profile");
  });

  it("validates the edit form before submitting", async () => {
    getProfileMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ success: true, data: baseProfile }),
    });

    const { Route } = await import("./profile");
    render(<Route.component />);

    await userEvent.click(await screen.findByRole("button", { name: "Edit Profile" }));
    await userEvent.clear(screen.getByLabelText("Full Name"));
    await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(await screen.findByText("Name is required")).toBeInTheDocument();
    expect(patchProfileMock).not.toHaveBeenCalled();
  });

  it("saves profile edits and updates the rendered fields", async () => {
    getProfileMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ success: true, data: baseProfile }),
    });
    patchProfileMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        success: true,
        data: {
          ...baseProfile,
          fullName: "Ada Byron",
          interests: ["Math", "Poetry"],
        },
      }),
    });

    const { Route } = await import("./profile");
    render(<Route.component />);

    await userEvent.click(await screen.findByRole("button", { name: "Edit Profile" }));
    await userEvent.clear(screen.getByLabelText("Full Name"));
    await userEvent.type(screen.getByLabelText("Full Name"), "Ada Byron");
    await userEvent.clear(screen.getByLabelText("Interests"));
    await userEvent.type(screen.getByLabelText("Interests"), "Math, Poetry");
    await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(patchProfileMock).toHaveBeenCalledWith({
        json: {
          fullName: "Ada Byron",
          faculty: "Computer Science",
          group: "CS-101",
          bio: "First programmer",
          interests: ["Math", "Poetry"],
        },
      });
    });
    expect((await screen.findAllByText("Ada Byron")).length).toBeGreaterThan(0);
    expect(toastSuccessMock).toHaveBeenCalledWith("Profile updated");
  });

  it("shows an error toast when saving profile edits fails", async () => {
    getProfileMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ success: true, data: baseProfile }),
    });
    patchProfileMock.mockResolvedValue({
      ok: false,
      json: vi.fn(),
    });

    const { Route } = await import("./profile");
    render(<Route.component />);

    await userEvent.click(await screen.findByRole("button", { name: "Edit Profile" }));
    await userEvent.clear(screen.getByLabelText("Full Name"));
    await userEvent.type(screen.getByLabelText("Full Name"), "Ada Failure");
    await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(patchProfileMock).toHaveBeenCalled();
    });
    expect(toastErrorMock).toHaveBeenCalledWith("Failed to update profile");
    expect(screen.getByLabelText("Full Name")).toBeInTheDocument();
  });

  it("uploads an avatar and refreshes the profile", async () => {
    // The second profile response represents the post-upload refetch that should hydrate the new avatar URL.
    getProfileMock
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ success: true, data: baseProfile }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          data: {
            ...baseProfile,
            avatarUrl: "https://cdn.example.com/avatar.png",
          },
        }),
      });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const { Route } = await import("./profile");
    const { container } = render(<Route.component />);

    await screen.findByRole("heading", { name: "Ada Lovelace" });
    const avatarInput = container.querySelector(
      "#profile-avatar-input",
    ) as HTMLInputElement;

    fireEvent.change(avatarInput, {
      target: {
        files: [new File(["img"], "avatar.png", { type: "image/png" })],
      },
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "https://server.example.com/api/profile/upload-avatar",
        expect.objectContaining({
          method: "POST",
          headers: { Authorization: "Bearer token-123" },
        }),
      );
      expect(getProfileMock).toHaveBeenCalledTimes(2);
    });
    expect(toastSuccessMock).toHaveBeenCalledWith("Avatar updated");
  });

  it("shows an error toast when avatar upload fails", async () => {
    getProfileMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ success: true, data: baseProfile }),
    });
    const fetchMock = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal("fetch", fetchMock);

    const { Route } = await import("./profile");
    const { container } = render(<Route.component />);

    await screen.findByRole("heading", { name: "Ada Lovelace" });
    const avatarInput = container.querySelector(
      "#profile-avatar-input",
    ) as HTMLInputElement;

    fireEvent.change(avatarInput, {
      target: {
        files: [new File(["img"], "avatar.png", { type: "image/png" })],
      },
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    expect(toastErrorMock).toHaveBeenCalledWith("Failed to upload avatar");
    expect(getProfileMock).toHaveBeenCalledTimes(1);
  });

  it("hydrates the activity gate from a failed background upload response", async () => {
    getProfileMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ success: true, data: baseProfile }),
    });
    readApiErrorResponseMock.mockResolvedValue({
      error: "Need an event first",
      activityGate: {
        ...baseProfile.activityGate,
        personalization: {
          registeredEventsCount: 1,
          permissions: { canChangeBackground: true },
        },
      },
    });
    // The failed upload returns a newer gate snapshot; the UI should adopt it even though the upload itself failed.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
      }),
    );

    const { Route } = await import("./profile");
    const { container } = render(<Route.component />);

    await screen.findByText("0/1 events");
    const backgroundInput = container.querySelector(
      "#profile-background-input",
    ) as HTMLInputElement;

    fireEvent.change(backgroundInput, {
      target: {
        files: [new File(["img"], "background.png", { type: "image/png" })],
      },
    });

    expect(await screen.findByText("1/1 events")).toBeInTheDocument();
    expect(toastErrorMock).toHaveBeenCalledWith("Need an event first");
  });

  it("uploads a background when the gate is unlocked", async () => {
    // This mirrors the real flow: initial fetch with an unlocked gate, then a refetch that includes the new background URL.
    getProfileMock
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          data: {
            ...baseProfile,
            activityGate: {
              ...baseProfile.activityGate,
              personalization: {
                registeredEventsCount: 1,
                permissions: { canChangeBackground: true },
              },
            },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          data: {
            ...baseProfile,
            backgroundUrl: "https://cdn.example.com/background.png",
            activityGate: {
              ...baseProfile.activityGate,
              personalization: {
                registeredEventsCount: 1,
                permissions: { canChangeBackground: true },
              },
            },
          },
        }),
      });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const { Route } = await import("./profile");
    const { container } = render(<Route.component />);

    await screen.findByText("1/1 events");
    const backgroundInput = container.querySelector(
      "#profile-background-input",
    ) as HTMLInputElement;

    fireEvent.change(backgroundInput, {
      target: {
        files: [new File(["img"], "background.png", { type: "image/png" })],
      },
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "https://server.example.com/api/profile/upload-background",
        expect.objectContaining({
          method: "POST",
          headers: { Authorization: "Bearer token-123" },
        }),
      );
      expect(getProfileMock).toHaveBeenCalledTimes(2);
    });
    expect(toastSuccessMock).toHaveBeenCalledWith("Background updated");
  });
});
