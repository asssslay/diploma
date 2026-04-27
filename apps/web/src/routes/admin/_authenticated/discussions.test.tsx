import React from "react";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  listDiscussionsMock,
  getDiscussionDetailMock,
  deleteDiscussionMock,
  deleteCommentMock,
  toastErrorMock,
  toastSuccessMock,
} = vi.hoisted(() => ({
  listDiscussionsMock: vi.fn(),
  getDiscussionDetailMock: vi.fn(),
  deleteDiscussionMock: vi.fn(),
  deleteCommentMock: vi.fn(),
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
      admin: {
        discussions: {
          $get: listDiscussionsMock,
          ":id": {
            $get: getDiscussionDetailMock,
            $delete: deleteDiscussionMock,
            comments: {
              ":commentId": {
                $delete: deleteCommentMock,
              },
            },
          },
        },
      },
    },
  })),
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({
    open,
    children,
  }: {
    open: boolean;
    children: React.ReactNode;
  }) => (open ? <div data-testid="dialog-root">{children}</div> : null),
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({
    open,
    children,
  }: {
    open: boolean;
    children: React.ReactNode;
  }) => (open ? <div data-testid="sheet-root">{children}</div> : null),
  SheetContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  SheetHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

const listResponse = {
  success: true as const,
  data: [
    {
      id: "discussion-1",
      title: "Exam prep",
      authorName: "Alice",
      category: "help",
      commentCount: 2,
      createdAt: "2030-05-01T12:00:00.000Z",
    },
  ],
  total: 1,
  page: 1,
  pageSize: 10,
};

const detailResponse = {
  success: true as const,
  data: {
    id: "discussion-1",
    title: "Exam prep",
    content: "How should I prepare?",
    category: "help",
    authorName: "Alice",
    viewCount: 8,
    commentCount: 1,
    createdAt: "2030-05-01T12:00:00.000Z",
    updatedAt: "2030-05-01T12:00:00.000Z",
    comments: [
      {
        id: "comment-1",
        authorName: "Bob",
        content: "Practice with previous exams.",
        createdAt: "2030-05-02T12:00:00.000Z",
        updatedAt: "2030-05-02T12:00:00.000Z",
      },
    ],
  },
};

describe("admin discussions route", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    listDiscussionsMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(listResponse),
    });
  });

  it("renders the empty state when no discussions are returned", async () => {
    listDiscussionsMock.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({
        success: true,
        data: [],
        total: 0,
        page: 1,
        pageSize: 10,
      }),
    });

    const { Route } = await import("./discussions");
    render(<Route.component />);

    expect(await screen.findByText("No discussions yet.")).toBeInTheDocument();
  });

  it("loads discussion details and renders the empty comments branch", async () => {
    getDiscussionDetailMock.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({
        ...detailResponse,
        data: {
          ...detailResponse.data,
          commentCount: 0,
          comments: [],
        },
      }),
    });

    const { Route } = await import("./discussions");
    render(<Route.component />);

    await userEvent.click(await screen.findByText("Exam prep"));

    await waitFor(() => {
      expect(getDiscussionDetailMock).toHaveBeenCalledWith({
        param: { id: "discussion-1" },
      });
    });
    expect(await screen.findByText("No comments.")).toBeInTheDocument();
  });

  it("shows an error when loading discussion details fails", async () => {
    getDiscussionDetailMock.mockResolvedValueOnce({ ok: false });

    const { Route } = await import("./discussions");
    render(<Route.component />);

    await userEvent.click(await screen.findByText("Exam prep"));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("Failed to load discussion");
    });
    expect(screen.queryByTestId("sheet-root")).not.toBeInTheDocument();
  });

  it("deletes a discussion and refetches the list", async () => {
    deleteDiscussionMock.mockResolvedValueOnce({ ok: true });
    listDiscussionsMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(listResponse),
    });

    // Successful deletion should refresh the list so moderation state is taken from the server, not local filtering.
    const { Route } = await import("./discussions");
    render(<Route.component />);

    await userEvent.click((await screen.findAllByTitle("Delete"))[0]);
    const dialog = await screen.findByTestId("dialog-root");
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(deleteDiscussionMock).toHaveBeenCalledWith({
        param: { id: "discussion-1" },
      });
    });
    expect(toastSuccessMock).toHaveBeenCalledWith("Discussion deleted");
    expect(listDiscussionsMock).toHaveBeenCalledTimes(2);
  });

  it("deletes a comment from the detail sheet and updates the visible count", async () => {
    getDiscussionDetailMock.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue(detailResponse),
    });
    deleteCommentMock.mockResolvedValueOnce({ ok: true });

    // Comment deletion is applied in-place to the open sheet, so the count and visible rows must both shrink immediately.
    const { Route } = await import("./discussions");
    render(<Route.component />);

    await userEvent.click(await screen.findByText("Exam prep"));
    expect(await screen.findByText("Practice with previous exams.")).toBeInTheDocument();

    await userEvent.click(screen.getByTitle("Delete comment"));
    const dialog = await screen.findByTestId("dialog-root");
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(deleteCommentMock).toHaveBeenCalledWith({
        param: { id: "discussion-1", commentId: "comment-1" },
      });
    });
    expect(toastSuccessMock).toHaveBeenCalledWith("Comment deleted");
    expect(screen.getByText("Comments (0)")).toBeInTheDocument();
    expect(screen.queryByText("Practice with previous exams.")).not.toBeInTheDocument();
  });
});
