import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  listDiscussionsMock,
  createDiscussionMock,
  readApiErrorResponseMock,
  toastErrorMock,
  toastSuccessMock,
} = vi.hoisted(() => ({
  listDiscussionsMock: vi.fn(),
  createDiscussionMock: vi.fn(),
  readApiErrorResponseMock: vi.fn(),
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

vi.mock("@/lib/api", () => ({
  getApiClient: vi.fn(async () => ({
    api: {
      discussions: {
        $get: listDiscussionsMock,
        $post: createDiscussionMock,
      },
    },
  })),
  readApiErrorResponse: readApiErrorResponseMock,
}));

const unlockedGate = {
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
};

describe("discussions route", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the viewer gate state and disables creation when locked", async () => {
    listDiscussionsMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        success: true,
        data: [],
        total: 0,
        viewerActivityGate: {
          ...unlockedGate,
          permissions: {
            canCommentOnDiscussions: false,
            canCreateDiscussions: false,
          },
        },
      }),
    });

    const { Route } = await import("./discussions");
    render(<Route.component />);

    expect(await screen.findByText(/Complete your profile first so you can comment/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /New Discussion/i })).toBeDisabled();
  });

  it("filters the rendered discussions by search", async () => {
    listDiscussionsMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        success: true,
        data: [
          {
            id: "discussion-1",
            title: "Algorithms tips",
            category: "academic",
            authorName: "Ada",
            createdAt: "2030-06-01T12:00:00.000Z",
            commentCount: 1,
            reactionsCount: 0,
            viewCount: 5,
          },
          {
            id: "discussion-2",
            title: "Campus party",
            category: "social",
            authorName: "Bob",
            createdAt: "2030-06-02T12:00:00.000Z",
            commentCount: 2,
            reactionsCount: 3,
            viewCount: 7,
          },
        ],
        total: 2,
        viewerActivityGate: unlockedGate,
      }),
    });

    const { Route } = await import("./discussions");
    render(<Route.component />);

    await screen.findByText("Algorithms tips");
    await userEvent.click(screen.getAllByRole("button")[1]);
    await userEvent.type(
      screen.getByPlaceholderText("Search discussions..."),
      "Algorithms",
    );

    expect(screen.getByText("Algorithms tips")).toBeInTheDocument();
    expect(screen.queryByText("Campus party")).not.toBeInTheDocument();
  });

  it("shows validation errors before posting a discussion", async () => {
    listDiscussionsMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        success: true,
        data: [],
        total: 0,
        viewerActivityGate: unlockedGate,
      }),
    });

    const { Route } = await import("./discussions");
    render(<Route.component />);

    await userEvent.click(await screen.findByRole("button", { name: /New Discussion/i }));
    await userEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByText("Title is required")).toBeInTheDocument();
    expect(screen.getByText("Category is required")).toBeInTheDocument();
    expect(createDiscussionMock).not.toHaveBeenCalled();
  });

  it("updates the viewer gate after a failed create response", async () => {
    listDiscussionsMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        success: true,
        data: [],
        total: 0,
        viewerActivityGate: unlockedGate,
      }),
    });
    createDiscussionMock.mockResolvedValue({ ok: false });
    readApiErrorResponseMock.mockResolvedValue({
      error: "Need a comment first",
      activityGate: {
        ...unlockedGate,
        permissions: {
          canCommentOnDiscussions: true,
          canCreateDiscussions: false,
        },
        commentsPosted: 0,
      },
    });

    const { Route } = await import("./discussions");
    render(<Route.component />);

    await userEvent.click(await screen.findByRole("button", { name: /New Discussion/i }));
    await userEvent.type(screen.getByLabelText("Title"), "Question");
    await userEvent.click(screen.getByRole("button", { name: "Help" }));
    await userEvent.type(screen.getByLabelText("Content"), "Need help");
    await userEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByText("Post 1 comment to unlock discussions (0/1).")).toBeInTheDocument();
    expect(toastErrorMock).toHaveBeenCalledWith("Need a comment first");
  });
});
