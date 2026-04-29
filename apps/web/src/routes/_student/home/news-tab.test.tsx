import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { NewsTab } from "./news-tab";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="#">{children}</a>,
}));

describe("NewsTab", () => {
  it("renders server-provided excerpts and exact pagination metadata", () => {
    render(
      <NewsTab
        page={2}
        total={19}
        totalPages={3}
        isLoading={false}
        search=""
        searchOpen={false}
        sortAsc={false}
        filteredNews={[
          {
            id: "news-1",
            title: "Campus Festival",
            excerpt: "Join us this weekend...",
            authorName: "Admin",
            imageUrl: null,
            publishedAt: "2030-05-03T12:00:00.000Z",
            viewCount: 12,
            createdAt: "2030-05-03T12:00:00.000Z",
            updatedAt: "2030-05-04T12:00:00.000Z",
          },
        ]}
        setPage={vi.fn()}
        setSearch={vi.fn()}
        setSearchOpen={vi.fn()}
        setSortAsc={vi.fn()}
      />,
    );

    expect(screen.getByText("Join us this weekend...")).toBeInTheDocument();
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();
  });
});
