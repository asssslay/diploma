import React, { createContext, useContext, useState } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  listNewsMock,
  listEventsMock,
  toastErrorMock,
} = vi.hoisted(() => ({
  listNewsMock: vi.fn(),
  listEventsMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="#">{children}</a>,
  createFileRoute: () => (config: Record<string, unknown>) => config,
}));

vi.mock("sonner", () => ({
  toast: {
    error: toastErrorMock,
  },
}));

vi.mock("@/context/auth", () => ({
  useAuth: vi.fn(() => ({
    profile: { fullName: "Alice Johnson" },
  })),
}));

vi.mock("@/lib/api", () => ({
  getApiClient: vi.fn(async () => ({
    api: {
      news: {
        $get: listNewsMock,
      },
      events: {
        $get: listEventsMock,
      },
    },
  })),
}));

vi.mock("@/components/ui/tabs", () => {
  const TabsContext = createContext<{
    value: string;
    setValue: (value: string) => void;
  } | null>(null);

  function Tabs({
    defaultValue,
    children,
  }: {
    defaultValue: string;
    children: React.ReactNode;
  }) {
    const [value, setValue] = useState(defaultValue);
    return (
      <TabsContext.Provider value={{ value, setValue }}>
        <div>{children}</div>
      </TabsContext.Provider>
    );
  }

  function TabsList({ children }: { children: React.ReactNode }) {
    return <div>{children}</div>;
  }

  function TabsTrigger({
    value,
    children,
  }: {
    value: string;
    children: React.ReactNode;
  }) {
    const context = useContext(TabsContext)!;
    return (
      <button type="button" onClick={() => context.setValue(value)}>
        {children}
      </button>
    );
  }

  function TabsContent({
    value,
    children,
  }: {
    value: string;
    children: React.ReactNode;
  }) {
    const context = useContext(TabsContext)!;
    return context.value === value ? <div>{children}</div> : null;
  }

  return { Tabs, TabsContent, TabsList, TabsTrigger };
});

const newsResponse = {
  success: true as const,
  data: [
    {
      id: "news-1",
      title: "Distributed Systems Update",
      content: "Cluster maintenance window",
      publishedAt: "2030-05-01T12:00:00.000Z",
      createdAt: "2030-05-01T12:00:00.000Z",
      updatedAt: "2030-05-01T12:00:00.000Z",
    },
    {
      id: "news-2",
      title: "Campus Festival",
      content: "Join us this weekend",
      publishedAt: "2030-05-03T12:00:00.000Z",
      createdAt: "2030-05-03T12:00:00.000Z",
      updatedAt: "2030-05-04T12:00:00.000Z",
    },
  ],
  total: 2,
  page: 1,
  pageSize: 9,
};

const eventsResponse = {
  success: true as const,
  data: [
    {
      id: "event-1",
      title: "Hackathon",
      eventDate: "2030-06-01T12:00:00.000Z",
      location: "Main Hall",
      maxParticipants: 10,
      registrationCount: 4,
      isRegistered: true,
      createdAt: "2030-05-01T12:00:00.000Z",
      updatedAt: "2030-05-01T12:00:00.000Z",
    },
    {
      id: "event-2",
      title: "Workshop",
      eventDate: "2030-06-02T12:00:00.000Z",
      location: "Lab 1",
      maxParticipants: 20,
      registrationCount: 20,
      isRegistered: false,
      createdAt: "2030-05-02T12:00:00.000Z",
      updatedAt: "2030-05-02T12:00:00.000Z",
    },
    {
      id: "event-3",
      title: "Design Sprint",
      eventDate: "2030-06-03T12:00:00.000Z",
      location: "Studio",
      maxParticipants: 30,
      registrationCount: 12,
      isRegistered: false,
      createdAt: "2030-05-03T12:00:00.000Z",
      updatedAt: "2030-05-03T12:00:00.000Z",
    },
  ],
  total: 3,
  page: 1,
  pageSize: 6,
};

describe("student home route", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    listNewsMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(newsResponse),
    });
    listEventsMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(eventsResponse),
    });
  });

  it("renders the welcome state and stat cards from fetched data", async () => {
    const { Route } = await import("./home");
    render(<Route.component />);

    expect(await screen.findByText("Welcome back, Alice")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("Campus Festival")).toBeInTheDocument();
  });

  it("filters the news list by search", async () => {
    const { Route } = await import("./home");
    render(<Route.component />);

    await screen.findByText("Campus Festival");
    await userEvent.click(
      screen.getByRole("button", { name: "Open news search" }),
    );
    await userEvent.type(screen.getByPlaceholderText("Search news..."), "distributed");

    expect(screen.getByText("Distributed Systems Update")).toBeInTheDocument();
    expect(screen.queryByText("Campus Festival")).not.toBeInTheDocument();
  });

  it("filters the events tab by registration state and availability", async () => {
    const { Route } = await import("./home");
    render(<Route.component />);

    await userEvent.click(screen.getByRole("button", { name: "Events" }));
    expect(await screen.findByText("Hackathon")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Registered" }));
    expect(screen.getByText("Hackathon")).toBeInTheDocument();
    expect(screen.queryByText("Workshop")).not.toBeInTheDocument();

    // "Available" intentionally keeps partially filled registrations and excludes only events that are already full.
    await userEvent.click(screen.getByRole("button", { name: "Available" }));

    expect(screen.getByText("Hackathon")).toBeInTheDocument();
    expect(screen.getByText("Design Sprint")).toBeInTheDocument();
    expect(screen.queryByText("Workshop")).not.toBeInTheDocument();
  });

  it("shows toast errors when news and events fail to load", async () => {
    listNewsMock.mockResolvedValueOnce({ ok: false });
    listEventsMock.mockResolvedValueOnce({ ok: false });

    // News and events load independently, so both failures should surface instead of one hiding the other.
    const { Route } = await import("./home");
    render(<Route.component />);

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("Failed to load news");
      expect(toastErrorMock).toHaveBeenCalledWith("Failed to load events");
    });
  });
});
