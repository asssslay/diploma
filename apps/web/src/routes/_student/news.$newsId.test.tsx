import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getNewsMock, toastErrorMock } = vi.hoisted(() => ({
  getNewsMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="#">{children}</a>,
  createFileRoute: () => (config: Record<string, unknown>) => ({
    ...config,
    useParams: () => ({ newsId: "news-1" }),
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
      news: {
        ":id": {
          $get: getNewsMock,
        },
      },
    },
  })),
}));

const detailResponse = {
  success: true as const,
  data: {
    id: "news-1",
    title: "Campus Festival",
    content: "Full article body",
    authorName: "Admin",
    imageUrl: "https://cdn.example.com/news.png",
    publishedAt: "2030-05-03T12:00:00.000Z",
    createdAt: "2030-05-03T12:00:00.000Z",
    updatedAt: "2030-05-04T12:00:00.000Z",
    viewCount: 12,
  },
};

describe("news detail route", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the not-found state when loading fails", async () => {
    getNewsMock.mockResolvedValueOnce({ ok: false });

    const { Route } = await import("./news.$newsId");
    render(<Route.component />);

    expect(await screen.findByText("News post not found.")).toBeInTheDocument();
    expect(toastErrorMock).toHaveBeenCalledWith("Failed to load news post");
  });

  it("renders the full news article with image and edited metadata", async () => {
    getNewsMock.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue(detailResponse),
    });

    const { Route } = await import("./news.$newsId");
    render(<Route.component />);

    expect(await screen.findByText("Campus Festival")).toBeInTheDocument();
    expect(screen.getByText("Full article body")).toBeInTheDocument();
    expect(screen.getByText(/12 views/)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Campus Festival" })).toHaveAttribute(
      "src",
      "https://cdn.example.com/news.png",
    );
    expect(screen.getByText(/Edited/)).toBeInTheDocument();
  });
});
