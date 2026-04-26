import React, { createContext, useContext, useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  listEventsMock,
  getEventDetailMock,
  createEventMock,
  updateEventMock,
  deleteEventMock,
  getSessionMock,
  toastErrorMock,
  toastSuccessMock,
} = vi.hoisted(() => ({
  listEventsMock: vi.fn(),
  getEventDetailMock: vi.fn(),
  createEventMock: vi.fn(),
  updateEventMock: vi.fn(),
  deleteEventMock: vi.fn(),
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
        events: {
          $get: listEventsMock,
          $post: createEventMock,
          ":id": {
            $get: getEventDetailMock,
            $patch: updateEventMock,
            $delete: deleteEventMock,
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

const eventList = {
  success: true as const,
  data: [
    {
      id: "event-1",
      title: "Hackathon",
      description: "Build things",
      imageUrl: "https://cdn.example.com/event.png",
      authorName: "Admin",
      eventDate: "2030-06-01T12:00:00.000Z",
      location: "Main Hall",
      maxParticipants: 50,
      registrationCount: 4,
      createdAt: "2030-05-01T12:00:00.000Z",
      updatedAt: "2030-05-01T12:00:00.000Z",
    },
  ],
  total: 1,
};

describe("admin events route", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        data: { imageUrl: "https://cdn.example.com/uploaded.png" },
      }),
    }));
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn(() => "blob:preview"),
      revokeObjectURL: vi.fn(),
    });
    listEventsMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(eventList),
    });
    getSessionMock.mockResolvedValue({
      data: { session: { access_token: "token-123" } },
    });
  });

  it("creates an event after uploading an image", async () => {
    createEventMock.mockResolvedValue({ ok: true });

    const { Route } = await import("./events");
    render(<Route.component />);

    await userEvent.click(await screen.findByRole("button", { name: /Create Event/i }));
    await userEvent.type(screen.getByLabelText("Title"), "New event");
    await userEvent.type(screen.getByLabelText("Description"), "Event details");
    await userEvent.type(screen.getByLabelText("Date & Time"), "2030-06-02T12:00");
    await userEvent.type(screen.getByLabelText("Max Participants"), "30");
    await userEvent.type(screen.getByLabelText("Location"), "Lab 1");
    fireEvent.change(screen.getByLabelText("Image (optional)"), {
      target: {
        files: [new File(["img"], "event.png", { type: "image/png" })],
      },
    });
    await userEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(createEventMock).toHaveBeenCalledWith({
        json: expect.objectContaining({
          title: "New event",
          description: "Event details",
          location: "Lab 1",
          maxParticipants: 30,
          imageUrl: "https://cdn.example.com/uploaded.png",
        }),
      });
    });
    expect(toastSuccessMock).toHaveBeenCalledWith("Event created");
  });

  it("loads registrations when an event is selected on the registrations tab", async () => {
    getEventDetailMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        success: true,
        data: {
          ...eventList.data[0],
          registrations: [
            {
              id: "reg-1",
              studentName: "Ada",
              studentEmail: "ada@example.com",
              group: "CS-101",
              registeredAt: "2030-05-05T12:00:00.000Z",
            },
          ],
          registrationCount: 1,
        },
      }),
    });

    const { Route } = await import("./events");
    render(<Route.component />);

    await userEvent.click(screen.getByRole("button", { name: "Registrations" }));
    await userEvent.click(await screen.findByRole("button", { name: "Hackathon" }));

    await waitFor(() => {
      expect(getEventDetailMock).toHaveBeenCalledWith({
        param: { id: "event-1" },
      });
    });
    expect(await screen.findByText("ada@example.com")).toBeInTheDocument();
  });

  it("deletes an event after confirmation", async () => {
    deleteEventMock.mockResolvedValue({ ok: true });

    const { Route } = await import("./events");
    render(<Route.component />);

    await userEvent.click((await screen.findAllByTitle("Delete"))[0]);
    await userEvent.click(await screen.findByRole("button", { name: "Confirm" }));

    await waitFor(() => {
      expect(deleteEventMock).toHaveBeenCalledWith({
        param: { id: "event-1" },
      });
    });
    expect(toastSuccessMock).toHaveBeenCalledWith("Event deleted");
  });
});
