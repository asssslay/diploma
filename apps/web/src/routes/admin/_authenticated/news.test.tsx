import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  listNewsMock,
  createNewsMock,
  updateNewsMock,
  deleteNewsMock,
  getSessionMock,
  toastErrorMock,
  toastSuccessMock,
} = vi.hoisted(() => ({
  listNewsMock: vi.fn(),
  createNewsMock: vi.fn(),
  updateNewsMock: vi.fn(),
  deleteNewsMock: vi.fn(),
  getSessionMock: vi.fn(),
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
        news: {
          $get: listNewsMock,
          $post: createNewsMock,
          ":id": {
            $patch: updateNewsMock,
            $delete: deleteNewsMock,
          },
        },
      },
    },
  })),
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

vi.mock("@/components/confirm-dialog", () => ({
  ConfirmDialog: ({
    open,
    title,
    onConfirm,
  }: {
    open: boolean;
    title: string;
    onConfirm: () => void;
  }) =>
    open ? (
      <div>
        <p>{title}</p>
        <button type="button" onClick={onConfirm}>
          Confirm
        </button>
      </div>
    ) : null,
}));

const newsList = {
  success: true as const,
  data: [
    {
      id: "post-1",
      title: "Campus update",
      content: "Semester starts soon",
      imageUrl: "https://cdn.example.com/news.png",
      authorName: "Admin",
      publishedAt: "2030-05-01T12:00:00.000Z",
      viewCount: 5,
      createdAt: "2030-05-01T12:00:00.000Z",
      updatedAt: "2030-05-01T12:00:00.000Z",
    },
  ],
  total: 1,
};

describe("admin news route", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        data: { imageUrl: "https://cdn.example.com/uploaded-news.png" },
      }),
    }));
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:preview"),
      revokeObjectURL: vi.fn(),
    });
    listNewsMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(newsList),
    });
    getSessionMock.mockResolvedValue({
      data: { session: { access_token: "token-123" } },
    });
  });

  it("creates a news post after uploading an image", async () => {
    createNewsMock.mockResolvedValue({ ok: true });

    const { Route } = await import("./news");
    render(<Route.component />);

    await userEvent.click(await screen.findByRole("button", { name: /Create News/i }));
    await userEvent.type(screen.getByLabelText("Title"), "New article");
    await userEvent.type(screen.getByLabelText("Content"), "Article body");
    fireEvent.change(screen.getByLabelText("Image (optional)"), {
      target: {
        files: [new File(["img"], "news.png", { type: "image/png" })],
      },
    });
    await userEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(createNewsMock).toHaveBeenCalledWith({
        json: {
          title: "New article",
          content: "Article body",
          imageUrl: "https://cdn.example.com/uploaded-news.png",
        },
      });
    });
    expect(toastSuccessMock).toHaveBeenCalledWith("News post created");
  });

  it("updates an existing news post", async () => {
    updateNewsMock.mockResolvedValue({ ok: true });

    const { Route } = await import("./news");
    render(<Route.component />);

    await userEvent.click((await screen.findAllByTitle("Edit"))[0]);
    await userEvent.clear(screen.getByLabelText("Title"));
    await userEvent.type(screen.getByLabelText("Title"), "Updated article");
    await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(updateNewsMock).toHaveBeenCalledWith({
        param: { id: "post-1" },
        json: {
          title: "Updated article",
          content: "Semester starts soon",
          imageUrl: "https://cdn.example.com/news.png",
        },
      });
    });
    expect(toastSuccessMock).toHaveBeenCalledWith("News post updated");
  });

  it("deletes a news post after confirmation", async () => {
    deleteNewsMock.mockResolvedValue({ ok: true });

    const { Route } = await import("./news");
    render(<Route.component />);

    await userEvent.click((await screen.findAllByTitle("Delete"))[0]);
    await userEvent.click(await screen.findByRole("button", { name: "Confirm" }));

    await waitFor(() => {
      expect(deleteNewsMock).toHaveBeenCalledWith({
        param: { id: "post-1" },
      });
    });
    expect(toastSuccessMock).toHaveBeenCalledWith("News post deleted");
  });
});
