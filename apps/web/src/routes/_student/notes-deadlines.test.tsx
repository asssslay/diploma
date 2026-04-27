import React, { createContext, useContext, useState } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  notesGetMock,
  notePostMock,
  notePatchMock,
  noteDeleteMock,
  deadlinesGetMock,
  deadlinePostMock,
  deadlinePatchMock,
  deadlineDeleteMock,
  toastErrorMock,
  toastSuccessMock,
} = vi.hoisted(() => ({
  notesGetMock: vi.fn(),
  notePostMock: vi.fn(),
  notePatchMock: vi.fn(),
  noteDeleteMock: vi.fn(),
  deadlinesGetMock: vi.fn(),
  deadlinePostMock: vi.fn(),
  deadlinePatchMock: vi.fn(),
  deadlineDeleteMock: vi.fn(),
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
          $patch: notePatchMock,
          $delete: noteDeleteMock,
        },
      },
      deadlines: {
        $get: deadlinesGetMock,
        $post: deadlinePostMock,
        ":id": {
          $patch: deadlinePatchMock,
          $delete: deadlineDeleteMock,
        },
      },
    },
  })),
}));

vi.mock("@/components/confirm-dialog", () => ({
  ConfirmDialog: ({
    open,
    title,
    confirmLabel,
    onOpenChange,
    onConfirm,
  }: {
    open: boolean;
    title: string;
    confirmLabel: string;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
  }) =>
    open ? (
      <div data-testid="confirm-dialog">
        <p>{title}</p>
        <button
          type="button"
          data-testid="confirm-dialog-cancel"
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </button>
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
    expect(await screen.findByText("Remember this")).toBeInTheDocument();
    expect(toastSuccessMock).toHaveBeenCalledWith("Note created");
  });

  it("filters notes with the search toolbar", async () => {
    notesGetMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        success: true,
        data: [
          noteList.data[0],
          {
            id: "note-2",
            title: "Lab checklist",
            content: "Prepare slides",
            createdAt: "2030-05-02T12:00:00.000Z",
            updatedAt: "2030-05-02T12:00:00.000Z",
          },
        ],
        total: 2,
      }),
    });

    const { Route } = await import("./notes-deadlines");
    render(<Route.component />);

    await userEvent.click(
      await screen.findByRole("button", { name: "Open notes search" }),
    );
    await userEvent.type(screen.getByPlaceholderText("Search notes..."), "lab");

    expect(screen.getByText("Lab checklist")).toBeInTheDocument();
    expect(screen.queryByText("Lecture notes")).not.toBeInTheDocument();
  });

  it("fetches the next page of notes", async () => {
    // The mock branches on the page query so we can verify the tab requests page 2 and swaps the rendered items.
    notesGetMock.mockImplementation(({ query }: { query: { page: string } }) =>
      Promise.resolve({
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          data:
            query.page === "2"
              ? [
                  {
                    id: "note-21",
                    title: "Page two note",
                    content: "Second page content",
                    createdAt: "2030-05-21T12:00:00.000Z",
                    updatedAt: "2030-05-21T12:00:00.000Z",
                  },
                ]
              : noteList.data,
          total: 21,
        }),
      }),
    );

    const { Route } = await import("./notes-deadlines");
    render(<Route.component />);

    expect(await screen.findByText("Page 1 of 2")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => {
      expect(notesGetMock).toHaveBeenLastCalledWith({
        query: { page: "2", pageSize: "20" },
      });
    });
    expect(await screen.findByText("Page 2 of 2")).toBeInTheDocument();
    expect(screen.getByText("Page two note")).toBeInTheDocument();
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

  it("edits an existing note from the view dialog", async () => {
    notePatchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        success: true,
        data: {
          ...noteList.data[0],
          title: "Updated lecture notes",
          content: "Updated content",
          updatedAt: "2030-05-02T12:00:00.000Z",
        },
      }),
    });

    const { Route } = await import("./notes-deadlines");
    render(<Route.component />);

    await userEvent.click(await screen.findByText("Lecture notes"));
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    await userEvent.clear(screen.getByLabelText("Title"));
    await userEvent.type(screen.getByLabelText("Title"), "Updated lecture notes");
    await userEvent.clear(screen.getByLabelText("Content"));
    await userEvent.type(screen.getByLabelText("Content"), "Updated content");
    await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(notePatchMock).toHaveBeenCalledWith({
        param: { id: "note-1" },
        json: {
          title: "Updated lecture notes",
          content: "Updated content",
        },
      });
    });
    expect(toastSuccessMock).toHaveBeenCalledWith("Note updated");
  });

  it("returns from note edit mode to view mode when cancelled", async () => {
    const { Route } = await import("./notes-deadlines");
    render(<Route.component />);

    await userEvent.click(await screen.findByText("Lecture notes"));
    await userEvent.click(screen.getAllByRole("button", { name: "Edit" })[0]);

    expect(screen.getByLabelText("Title")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    // Cancel should restore the read-only detail dialog, not close the modal entirely.
    expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
    expect(screen.getAllByText("Distributed systems")).toHaveLength(2);
  });

  it("shows an error toast when creating a note fails", async () => {
    notePostMock.mockResolvedValue({ ok: false });

    const { Route } = await import("./notes-deadlines");
    render(<Route.component />);

    await userEvent.click(await screen.findByRole("button", { name: /New Note/i }));
    await userEvent.type(screen.getByLabelText("Title"), "Broken note");
    await userEvent.type(screen.getByLabelText("Content"), "This will fail");
    await userEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(notePostMock).toHaveBeenCalledWith({
        json: { title: "Broken note", content: "This will fail" },
      });
    });
    expect(toastErrorMock).toHaveBeenCalledWith("Failed to create note");
  });

  it("opens and closes the note delete confirmation dialog", async () => {
    const { Route } = await import("./notes-deadlines");
    render(<Route.component />);

    await userEvent.click(await screen.findByText("Lecture notes"));
    await userEvent.click(screen.getAllByRole("button", { name: "Delete" })[0]);

    expect(await screen.findByTestId("confirm-dialog")).toBeInTheDocument();

    await userEvent.click(screen.getByTestId("confirm-dialog-cancel"));

    await waitFor(() => {
      expect(screen.queryByTestId("confirm-dialog")).not.toBeInTheDocument();
    });
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

  it("filters and sorts deadlines", async () => {
    deadlinesGetMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        success: true,
        data: [
          {
            ...deadlineList.data[0],
            id: "deadline-2",
            title: "Research presentation",
            dueAt: "2030-06-10T12:00:00.000Z",
          },
          {
            ...deadlineList.data[0],
            id: "deadline-1",
            title: "Algorithms exam",
            dueAt: "2030-06-01T12:00:00.000Z",
          },
        ],
        total: 2,
      }),
    });

    const { Route } = await import("./notes-deadlines");
    render(<Route.component />);

    await userEvent.click(screen.getByRole("button", { name: "Deadlines" }));

    let headings = await screen.findAllByRole("heading", { level: 3 });
    expect(headings.map((heading) => heading.textContent)).toEqual([
      "Algorithms exam",
      "Research presentation",
    ]);

    await userEvent.click(
      screen.getByRole("button", { name: "Sort deadlines by due date" }),
    );

    headings = await screen.findAllByRole("heading", { level: 3 });
    expect(headings.map((heading) => heading.textContent)).toEqual([
      "Research presentation",
      "Algorithms exam",
    ]);

    await userEvent.click(
      screen.getByRole("button", { name: "Open deadlines search" }),
    );
    await userEvent.type(
      screen.getByPlaceholderText("Search deadlines..."),
      "research",
    );

    expect(screen.getByText("Research presentation")).toBeInTheDocument();
    expect(screen.queryByText("Algorithms exam")).not.toBeInTheDocument();
  });

  it("validates that deadlines must be in the future", async () => {
    const { Route } = await import("./notes-deadlines");
    render(<Route.component />);

    await userEvent.click(screen.getByRole("button", { name: "Deadlines" }));
    await userEvent.click(await screen.findByRole("button", { name: /New Deadline/i }));
    await userEvent.type(screen.getByLabelText("Title"), "Past deadline");
    await userEvent.type(screen.getByLabelText("Due date"), "2000-01-01T12:00");
    await userEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(
      await screen.findByText("Due date must be in the future"),
    ).toBeInTheDocument();
    expect(deadlinePostMock).not.toHaveBeenCalled();
  });

  it("edits an existing deadline", async () => {
    deadlinePatchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        success: true,
        data: {
          ...deadlineList.data[0],
          title: "Updated algorithms exam",
          dueAt: "2030-06-03T13:30:00.000Z",
        },
      }),
    });

    const { Route } = await import("./notes-deadlines");
    render(<Route.component />);

    await userEvent.click(screen.getByRole("button", { name: "Deadlines" }));
    await userEvent.click(await screen.findByText("Algorithms exam"));
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    await userEvent.clear(screen.getByLabelText("Title"));
    await userEvent.type(
      screen.getByLabelText("Title"),
      "Updated algorithms exam",
    );
    await userEvent.clear(screen.getByLabelText("Due date"));
    await userEvent.type(
      screen.getByLabelText("Due date"),
      "2030-06-03T13:30",
    );
    await userEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(deadlinePatchMock).toHaveBeenCalledWith({
        param: { id: "deadline-1" },
        json: {
          title: "Updated algorithms exam",
          dueAt: new Date("2030-06-03T13:30").toISOString(),
        },
      });
    });
    expect(toastSuccessMock).toHaveBeenCalledWith("Deadline updated");
  });

  it("renders multiple deadline urgency states", async () => {
    // Relative dates keep this test focused on urgency buckets instead of hard-coding labels to one fixed calendar day.
    deadlinesGetMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        success: true,
        data: [
          {
            ...deadlineList.data[0],
            id: "deadline-overdue",
            title: "Past item",
            dueAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          },
          {
            ...deadlineList.data[0],
            id: "deadline-later",
            title: "Future item",
            dueAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
          },
        ],
        total: 2,
      }),
    });

    const { Route } = await import("./notes-deadlines");
    render(<Route.component />);

    await userEvent.click(screen.getByRole("button", { name: "Deadlines" }));

    expect(await screen.findByText("Overdue")).toBeInTheDocument();
    expect(screen.getByText("Later")).toBeInTheDocument();
  });

  it("deletes a deadline from the view dialog", async () => {
    deadlineDeleteMock.mockResolvedValue({ ok: true });

    const { Route } = await import("./notes-deadlines");
    render(<Route.component />);

    await userEvent.click(screen.getByRole("button", { name: "Deadlines" }));
    await userEvent.click(await screen.findByText("Algorithms exam"));
    await userEvent.click(screen.getByRole("button", { name: /^Delete$/i }));
    await screen.findByTestId("confirm-dialog");
    await userEvent.click(screen.getByTestId("confirm-dialog-submit"));

    await waitFor(() => {
      expect(deadlineDeleteMock).toHaveBeenCalledWith({
        param: { id: "deadline-1" },
      });
    });
    expect(toastSuccessMock).toHaveBeenCalledWith("Deadline deleted");
  });

  it("opens and closes the deadline delete confirmation dialog", async () => {
    const { Route } = await import("./notes-deadlines");
    render(<Route.component />);

    await userEvent.click(screen.getByRole("button", { name: "Deadlines" }));
    await userEvent.click(await screen.findByText("Algorithms exam"));
    await userEvent.click(screen.getAllByRole("button", { name: "Delete" })[0]);

    expect(await screen.findByTestId("confirm-dialog")).toBeInTheDocument();

    await userEvent.click(screen.getByTestId("confirm-dialog-cancel"));

    await waitFor(() => {
      expect(screen.queryByTestId("confirm-dialog")).not.toBeInTheDocument();
    });
  });

  it("shows an error toast when deadlines fail to load", async () => {
    deadlinesGetMock.mockResolvedValue({ ok: false });

    const { Route } = await import("./notes-deadlines");
    render(<Route.component />);

    await userEvent.click(screen.getByRole("button", { name: "Deadlines" }));

    await waitFor(() => {
      expect(deadlinesGetMock).toHaveBeenCalled();
    });
    expect(toastErrorMock).toHaveBeenCalledWith("Failed to load deadlines");
    expect(
      await screen.findByText("No deadlines yet. Create one!"),
    ).toBeInTheDocument();
  });

  it("exposes accessible labels for notes and deadline icon controls", async () => {
    const { Route } = await import("./notes-deadlines");
    render(<Route.component />);

    expect(
      await screen.findByRole("button", { name: "Open notes search" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Lecture notes actions" }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Deadlines" }));

    expect(
      await screen.findByRole("button", { name: "Open deadlines search" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Algorithms exam actions" }),
    ).toBeInTheDocument();
  });
});
