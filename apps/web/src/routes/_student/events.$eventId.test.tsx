import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  getEventMock,
  registerMock,
  unregisterMock,
  toastErrorMock,
  toastSuccessMock,
} = vi.hoisted(() => ({
  getEventMock: vi.fn(),
  registerMock: vi.fn(),
  unregisterMock: vi.fn(),
  toastErrorMock: vi.fn(),
  toastSuccessMock: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="#">{children}</a>,
  createFileRoute: () => (config: Record<string, unknown>) => ({
    ...config,
    useParams: () => ({ eventId: "event-1" }),
  }),
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
      events: {
        ":id": {
          $get: getEventMock,
          register: {
            $post: registerMock,
            $delete: unregisterMock,
          },
        },
      },
    },
  })),
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const baseEvent = {
  success: true as const,
  data: {
    id: "event-1",
    title: "Hackathon",
    description: "Build something",
    imageUrl: null,
    authorName: "Admin",
    eventDate: "2030-06-01T12:00:00.000Z",
    location: "Main Hall",
    maxParticipants: 10,
    registrationCount: 3,
    isRegistered: false,
    createdAt: "2030-05-01T12:00:00.000Z",
    updatedAt: "2030-05-01T12:00:00.000Z",
  },
};

describe("event detail route", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the not-found state when loading fails", async () => {
    getEventMock.mockResolvedValue({
      ok: false,
      json: vi.fn(),
    });

    const { Route } = await import("./events.$eventId");
    render(<Route.component />);

    expect(await screen.findByText("Event not found.")).toBeInTheDocument();
    expect(toastErrorMock).toHaveBeenCalledWith("Failed to load event");
  });

  it("renders the full-event state", async () => {
    getEventMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        ...baseEvent,
        data: {
          ...baseEvent.data,
          registrationCount: 10,
        },
      }),
    });

    const { Route } = await import("./events.$eventId");
    render(<Route.component />);

    expect(await screen.findByText("Event Full")).toBeInTheDocument();
    expect(screen.getByText("All 10 spots have been taken.")).toBeInTheDocument();
  });

  it("registers for an event and refetches details", async () => {
    getEventMock
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(baseEvent),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          ...baseEvent,
          data: {
            ...baseEvent.data,
            isRegistered: true,
            registrationCount: 4,
          },
        }),
      });
    registerMock.mockResolvedValue({ ok: true });

    const { Route } = await import("./events.$eventId");
    render(<Route.component />);

    await userEvent.click(await screen.findByRole("button", { name: "Register for Event" }));

    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledWith({
        param: { id: "event-1" },
      });
    });
    expect(toastSuccessMock).toHaveBeenCalledWith("Registered for event");
    expect(getEventMock).toHaveBeenCalledTimes(2);
  });

  it("unregisters from an event", async () => {
    getEventMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        ...baseEvent,
        data: {
          ...baseEvent.data,
          isRegistered: true,
        },
      }),
    });
    unregisterMock.mockResolvedValue({ ok: true });

    const { Route } = await import("./events.$eventId");
    render(<Route.component />);

    await userEvent.click(await screen.findByRole("button", { name: "Unregister" }));

    await waitFor(() => {
      expect(unregisterMock).toHaveBeenCalledWith({
        param: { id: "event-1" },
      });
    });
    expect(toastSuccessMock).toHaveBeenCalledWith("Unregistered from event");
  });
});
