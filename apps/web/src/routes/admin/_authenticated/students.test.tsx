import React from "react";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  listApplicationsMock,
  approveApplicationMock,
  rejectApplicationMock,
  toastErrorMock,
  toastSuccessMock,
} = vi.hoisted(() => ({
  listApplicationsMock: vi.fn(),
  approveApplicationMock: vi.fn(),
  rejectApplicationMock: vi.fn(),
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
        applications: {
          $get: listApplicationsMock,
          ":id": {
            approve: {
              $patch: approveApplicationMock,
            },
            reject: {
              $patch: rejectApplicationMock,
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
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

vi.mock("@/components/ui/tabs", async () => {
  const ReactModule = await import("react");
  const TabsContext = ReactModule.createContext<((value: string) => void) | null>(null);

  function Tabs({
    onValueChange,
    children,
  }: {
    onValueChange?: (value: string) => void;
    children: React.ReactNode;
  }) {
    return (
      <TabsContext.Provider value={onValueChange ?? null}>
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
    const onValueChange = ReactModule.useContext(TabsContext);
    return (
      <button type="button" onClick={() => onValueChange?.(value)}>
        {children}
      </button>
    );
  }

  return { Tabs, TabsList, TabsTrigger };
});

const applicationsResponse = {
  success: true as const,
  data: [
    {
      id: "application-1",
      fullName: "Alice Johnson",
      email: "alice@example.edu",
      group: "CS-101",
      createdAt: "2030-05-01T12:00:00.000Z",
      status: "pending" as const,
    },
    {
      id: "application-2",
      fullName: "Bob Smith",
      email: "bob@example.edu",
      group: "CS-102",
      createdAt: "2030-05-02T12:00:00.000Z",
      status: "approved" as const,
    },
  ],
  total: 2,
  page: 1,
  pageSize: 10,
};

describe("admin students route", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    listApplicationsMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(applicationsResponse),
    });
  });

  it("filters applications by status and refetches", async () => {
    const { Route } = await import("./students");
    render(<Route.component />);

    await screen.findByText("Alice Johnson");
    await userEvent.click(screen.getByRole("button", { name: "Pending" }));

    await waitFor(() => {
      expect(listApplicationsMock).toHaveBeenLastCalledWith({
        query: {
          status: "pending",
          page: "1",
          pageSize: "10",
        },
      });
    });
  });

  it("approves a pending application and refetches the list", async () => {
    approveApplicationMock.mockResolvedValueOnce({ ok: true });

    const { Route } = await import("./students");
    render(<Route.component />);

    await userEvent.click((await screen.findAllByTitle("Approve"))[0]);

    await waitFor(() => {
      expect(approveApplicationMock).toHaveBeenCalledWith({
        param: { id: "application-1" },
      });
    });
    expect(toastSuccessMock).toHaveBeenCalledWith("Application approved");
    expect(listApplicationsMock).toHaveBeenCalledTimes(2);
  });

  it("requires a reject reason and submits the trimmed value", async () => {
    rejectApplicationMock.mockResolvedValueOnce({ ok: true });

    const { Route } = await import("./students");
    render(<Route.component />);

    await userEvent.click((await screen.findAllByTitle("Reject"))[0]);
    const dialog = await screen.findByTestId("dialog-root");
    const rejectButton = within(dialog).getByRole("button", { name: "Reject" });
    expect(rejectButton).toBeDisabled();

    await userEvent.type(
      screen.getByPlaceholderText("Enter rejection reason..."),
      "  Missing student ID  ",
    );
    expect(rejectButton).toBeEnabled();
    await userEvent.click(rejectButton);

    await waitFor(() => {
      expect(rejectApplicationMock).toHaveBeenCalledWith({
        param: { id: "application-1" },
        json: { reason: "Missing student ID" },
      });
    });
    expect(toastSuccessMock).toHaveBeenCalledWith("Application rejected");
  });

  it("renders the empty state when no applications are returned", async () => {
    listApplicationsMock.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({
        success: true,
        data: [],
        total: 0,
        page: 1,
        pageSize: 10,
      }),
    });

    const { Route } = await import("./students");
    render(<Route.component />);

    expect(await screen.findByText("No applications found.")).toBeInTheDocument();
  });
});
