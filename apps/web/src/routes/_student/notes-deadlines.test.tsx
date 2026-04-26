import React, { createContext, useContext, useState } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  notesGetMock,
  notePostMock,
  noteDeleteMock,
  deadlinesGetMock,
  deadlinePostMock,
  toastErrorMock,
  toastSuccessMock,
} = vi.hoisted(() => ({
  notesGetMock: vi.fn(),
  notePostMock: vi.fn(),
  noteDeleteMock: vi.fn(),
  deadlinesGetMock: vi.fn(),
  deadlinePostMock: vi.fn(),
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
      notes: {
        $get: notesGetMock,
        $post: notePostMock,
        ":id": {
          $delete: noteDeleteMock,
        },
      },
      deadlines: {
        $get: deadlinesGetMock,
        $post: deadlinePostMock,
      },
    },
  })),
}));

vi.mock("@/components/confirm-dialog", () => ({
  ConfirmDialog: ({
    open,
    title,
    confirmLabel,
    onConfirm,
  }: {
    open: boolean;
    title: string;
    confirmLabel: string;
    onConfirm: () => void;
  }) =>
    open ? (
      <div data-testid="confirm-dialog">
        <p>{title}</p>
        <button
          type="button"
          data-testid="confirm-dialog-submit"
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    ) : null,
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button type="button" {...props}>{children}</button>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
  DropdownMenuSeparator: () => <hr />,
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

const noteList = {
  success: true as const,
  data: [
    {
      id: "note-1",
      title: "Lecture notes",
      content: "Distributed systems",
      createdAt: "2030-05-01T12:00:00.000Z",
      updatedAt: "2030-05-01T12:00:00.000Z",
    },
  ],
  total: 1,
};

const deadlineList = {
  success: true as const,
  data: [
    {
      id: "deadline-1",
      title: "Algorithms exam",
      dueAt: "2030-06-01T12:00:00.000Z",
      reminder24hEmailId: "reminder-24",
      reminder1hEmailId: null,
      createdAt: "2030-05-01T12:00:00.000Z",
      updatedAt: "2030-05-01T12:00:00.000Z",
    },
  ],
  total: 1,
};

describe("notes and deadlines route", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    notesGetMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(noteList),
    });
    deadlinesGetMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(deadlineList),
    });
  });

  it("creates a note from the notes tab", async () => {
    notePostMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        success: true,
        data: {
          id: "note-2",
          title: "New note",
          content: "Remember this",
          createdAt: "2030-05-02T12:00:00.000Z",
          updatedAt: "2030-05-02T12:00:00.000Z",
        },
      }),
    });

    const { Route } = await import("./notes-deadlines");
    render(<Route.component />);

    await userEvent.click(await screen.findByRole("button", { name: /New Note/i }));
    await userEvent.type(screen.getByLabelText("Title"), "New note");
    await userEvent.type(screen.getByLabelText("Content"), "Remember this");
    await userEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(notePostMock).toHaveBeenCalledWith({
        json: { title: "New note", content: "Remember this" },
      });
    });
    expect(toastSuccessMock).toHaveBeenCalledWith("Note created");
  });

  it("deletes a note from the view dialog", async () => {
    noteDeleteMock.mockResolvedValue({ ok: true });

    const { Route } = await import("./notes-deadlines");
    render(<Route.component />);

    await userEvent.click(await screen.findByText("Lecture notes"));
    await userEvent.click(screen.getByRole("button", { name: /^Delete$/i }));
    await screen.findByTestId("confirm-dialog");
    await userEvent.click(screen.getByTestId("confirm-dialog-submit"));

    await waitFor(() => {
      expect(noteDeleteMock).toHaveBeenCalledWith({
        param: { id: "note-1" },
      });
    });
    expect(toastSuccessMock).toHaveBeenCalledWith("Note deleted");
  });

  it("creates a deadline from the deadlines tab", async () => {
    deadlinePostMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        success: true,
        data: {
          id: "deadline-2",
          title: "New deadline",
          dueAt: "2030-06-02T12:00:00.000Z",
        },
      }),
    });

    const { Route } = await import("./notes-deadlines");
    render(<Route.component />);

    await userEvent.click(screen.getByRole("button", { name: "Deadlines" }));
    await userEvent.click(await screen.findByRole("button", { name: /New Deadline/i }));
    await userEvent.type(screen.getByLabelText("Title"), "New deadline");
    await userEvent.type(
      screen.getByLabelText("Due date"),
      "2030-06-02T12:00",
    );
    await userEvent.click(screen.getByRole("button", { name: "Create" }));

    const expectedDueAt = new Date("2030-06-02T12:00").toISOString();

    await waitFor(() => {
      expect(deadlinePostMock).toHaveBeenCalledWith({
        json: {
          title: "New deadline",
          dueAt: expectedDueAt,
        },
      });
    });
    expect(toastSuccessMock).toHaveBeenCalledWith("Deadline created");
  });
});
