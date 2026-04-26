import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  detailMock,
  reactDiscussionPostMock,
  reactDiscussionDeleteMock,
  createCommentMock,
  deleteCommentMock,
  reactCommentPostMock,
  reactCommentDeleteMock,
  patchDiscussionMock,
  patchCommentMock,
  readApiErrorResponseMock,
  toastErrorMock,
  toastSuccessMock,
} = vi.hoisted(() => ({
  detailMock: vi.fn(),
  reactDiscussionPostMock: vi.fn(),
  reactDiscussionDeleteMock: vi.fn(),
  createCommentMock: vi.fn(),
  deleteCommentMock: vi.fn(),
  reactCommentPostMock: vi.fn(),
  reactCommentDeleteMock: vi.fn(),
  patchDiscussionMock: vi.fn(),
  patchCommentMock: vi.fn(),
  readApiErrorResponseMock: vi.fn(),
  toastErrorMock: vi.fn(),
  toastSuccessMock: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="#">{children}</a>,
  createFileRoute: () => (config: Record<string, unknown>) => ({
    ...config,
    useParams: () => ({ discussionId: "discussion-1" }),
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: toastErrorMock,
    success: toastSuccessMock,
  },
}));

vi.mock("@/context/auth", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

vi.mock("@/lib/api", () => ({
  getApiClient: vi.fn(async () => ({
    api: {
      discussions: {
        ":id": {
          $get: detailMock,
          $patch: patchDiscussionMock,
          react: {
            $post: reactDiscussionPostMock,
            $delete: reactDiscussionDeleteMock,
          },
          comments: {
            $post: createCommentMock,
            ":commentId": {
              $delete: deleteCommentMock,
              $patch: patchCommentMock,
              react: {
                $post: reactCommentPostMock,
                $delete: reactCommentDeleteMock,
              },
            },
          },
        },
      },
    },
  })),
  readApiErrorResponse: readApiErrorResponseMock,
}));

const viewerGate = {
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

const baseDetail = {
  success: true as const,
  viewerActivityGate: viewerGate,
  data: {
    id: "discussion-1",
    authorId: "user-1",
    authorName: "Ada",
    title: "Welcome thread",
    content: "Hello everyone",
    category: "general",
    createdAt: "2030-06-01T12:00:00.000Z",
    updatedAt: "2030-06-01T12:00:00.000Z",
    viewCount: 3,
    reactionsCount: 2,
    isReacted: false,
    comments: [
      {
        id: "comment-1",
        authorId: "user-1",
        authorName: "Ada",
        content: "Nice post",
        createdAt: "2030-06-01T12:00:00.000Z",
        updatedAt: "2030-06-01T12:00:00.000Z",
        reactionsCount: 10,
        isReacted: false,
        authorHasHelpfulMarker: false,
      },
    ],
  },
};

describe("discussion detail route", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    detailMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(baseDetail),
    });
  });

  it("optimistically reacts to the discussion", async () => {
    reactDiscussionPostMock.mockResolvedValue({ ok: true });

    const { Route } = await import("./discussions_.$discussionId");
    render(<Route.component />);

    const reactButton = await screen.findByRole("button", { name: /2/ });
    await userEvent.click(reactButton);

    expect(await screen.findByRole("button", { name: /3/ })).toBeInTheDocument();
    expect(reactDiscussionPostMock).toHaveBeenCalledWith({
      param: { id: "discussion-1" },
    });
  });

  it("adds a comment and appends it to the discussion", async () => {
    createCommentMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        data: {
          id: "comment-2",
          authorId: "user-1",
          authorName: "Ada",
          content: "Second reply",
          createdAt: "2030-06-01T13:00:00.000Z",
          updatedAt: "2030-06-01T13:00:00.000Z",
          authorHasHelpfulMarker: false,
        },
      }),
    });

    const { Route } = await import("./discussions_.$discussionId");
    render(<Route.component />);

    await userEvent.type(await screen.findByPlaceholderText("Write a comment..."), "Second reply");
    await userEvent.click(screen.getByRole("button", { name: "Post Comment" }));

    expect(await screen.findByText("Second reply")).toBeInTheDocument();
  });

  it("applies a locked gate after a failed comment creation", async () => {
    createCommentMock.mockResolvedValue({ ok: false });
    readApiErrorResponseMock.mockResolvedValue({
      error: "Profile incomplete",
      activityGate: {
        ...viewerGate,
        permissions: {
          canCommentOnDiscussions: false,
          canCreateDiscussions: false,
        },
        profileCompletion: {
          isComplete: false,
          completedFields: 4,
          totalFields: 5,
          missingRequiredProfileFields: ["fullName"],
        },
      },
    });

    const { Route } = await import("./discussions_.$discussionId");
    render(<Route.component />);

    await userEvent.type(await screen.findByPlaceholderText("Write a comment..."), "Blocked reply");
    await userEvent.click(screen.getByRole("button", { name: "Post Comment" }));

    expect(await screen.findByText(/Complete your profile to unlock comments/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Write a comment...")).toBeDisabled();
  });

  it("shows the helpful badge and achievement toast when a comment reaction unlocks it", async () => {
    reactCommentPostMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        success: true,
        data: {
          reacted: true,
          helpfulMarker: {
            authorId: "user-1",
            authorName: "Ada",
            authorHasHelpfulMarker: true,
            achievementEarned: true,
          },
        },
      }),
    });

    const { Route } = await import("./discussions_.$discussionId");
    render(<Route.component />);

    const buttons = await screen.findAllByRole("button", { name: /10/ });
    await userEvent.click(buttons[0]);

    expect(
      await screen.findByText((content) => content.includes("Helpful")),
    ).toBeInTheDocument();
    expect(toastSuccessMock).toHaveBeenCalledWith(
      "Achievement unlocked: Helpful contributor",
      expect.objectContaining({
        description: "One of your comments passed 10 positive reactions.",
      }),
    );
  });
});
