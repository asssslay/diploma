import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownAZ,
  ArrowUpAZ,
  CalendarClock,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  StickyNote,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import type { InferResponseType } from "hono/client";
import { hc } from "hono/client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, isEdited } from "@/lib/utils";
import { getApiClient } from "@/lib/api";
import type { AppType } from "server";

type Client = ReturnType<typeof hc<AppType>>;
type ListEndpoint = Client["api"]["notes"]["$get"];
type ListResponse = Extract<InferResponseType<ListEndpoint>, { success: true }>;
type Note = ListResponse["data"][number];

type DeadlinesListEndpoint = Client["api"]["deadlines"]["$get"];
type DeadlinesListResponse = Extract<
  InferResponseType<DeadlinesListEndpoint>,
  { success: true }
>;
type Deadline = DeadlinesListResponse["data"][number];

export const Route = createFileRoute("/_student/notes-deadlines")({
  component: NotesDeadlinesPage,
});

const noteSchema = z.object({
  title: z.string().min(1, { message: "Title is required" }).max(200),
  content: z.string().min(1, { message: "Content is required" }).max(5000),
});

type FieldErrors = Partial<Record<keyof z.infer<typeof noteSchema>, string>>;

function NotesDeadlinesPage() {
  return (
    <div className="space-y-6 px-8 py-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Notes & Deadlines</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Keep track of your personal notes and upcoming deadlines.
        </p>
      </div>

      <Tabs defaultValue="notes">
        <TabsList>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="deadlines">Deadlines</TabsTrigger>
        </TabsList>

        <TabsContent value="notes" className="mt-6">
          <NotesTab />
        </TabsContent>

        <TabsContent value="deadlines" className="mt-6">
          <DeadlinesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function NotesTab() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [isLoading, setIsLoading] = useState(true);

  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [sortAsc, setSortAsc] = useState(false);

  // Single dialog state: null = closed, note + mode = open
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [mode, setMode] = useState<"view" | "edit" | "create">("view");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const dialogOpen = activeNote !== null || mode === "create";

  const totalPages = Math.ceil(total / pageSize);

  const fetchNotes = useCallback(async () => {
    setIsLoading(true);
    try {
      const api = await getApiClient();
      const res = await api.api.notes.$get({
        query: { page: String(page), pageSize: String(pageSize) },
      });
      if (!res.ok) {
        toast.error("Failed to load notes");
        return;
      }
      const json = (await res.json()) as ListResponse;
      setNotes(json.data);
      setTotal(json.total);
    } catch {
      toast.error("Failed to load notes");
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const filtered = useMemo(() => {
    let result = [...notes];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q),
      );
    }
    result.sort((a, b) => {
      const da = new Date(a.updatedAt).getTime();
      const db = new Date(b.updatedAt).getTime();
      return sortAsc ? da - db : db - da;
    });
    return result;
  }, [notes, search, sortAsc]);

  function closeDialog() {
    setActiveNote(null);
    setMode("view");
    setTitle("");
    setContent("");
    setErrors({});
  }

  function openView(note: Note) {
    setActiveNote(note);
    setMode("view");
  }

  function openCreate() {
    setActiveNote(null);
    setTitle("");
    setContent("");
    setErrors({});
    setMode("create");
  }

  function startEdit(note: Note) {
    setActiveNote(note);
    setTitle(note.title);
    setContent(note.content);
    setErrors({});
    setMode("edit");
  }

  function cancelEdit() {
    if (activeNote) {
      setMode("view");
      setErrors({});
    } else {
      closeDialog();
    }
  }

  async function handleSave() {
    const result = noteSchema.safeParse({ title, content });
    if (!result.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof FieldErrors;
        if (!fieldErrors[field]) fieldErrors[field] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);
    try {
      const api = await getApiClient();

      if (mode === "edit" && activeNote) {
        const res = await api.api.notes[":id"].$patch({
          param: { id: activeNote.id },
          json: { title: result.data.title, content: result.data.content },
        });
        if (!res.ok) {
          toast.error("Failed to update note");
          return;
        }
        const json = (await res.json()) as { success: true; data: Note };
        setActiveNote(json.data);
        setMode("view");
        toast.success("Note updated");
        fetchNotes();
      } else {
        const res = await api.api.notes.$post({
          json: { title: result.data.title, content: result.data.content },
        });
        if (!res.ok) {
          toast.error("Failed to create note");
          return;
        }
        const json = (await res.json()) as { success: true; data: Note };
        setActiveNote(json.data);
        setMode("view");
        toast.success("Note created");
        fetchNotes();
      }
    } catch {
      toast.error(
        mode === "edit" ? "Failed to update note" : "Failed to create note",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(noteId: string) {
    try {
      const api = await getApiClient();
      const res = await api.api.notes[":id"].$delete({
        param: { id: noteId },
      });
      if (!res.ok) {
        toast.error("Failed to delete note");
        return;
      }
      toast.success("Note deleted");
      closeDialog();
      fetchNotes();
    } catch {
      toast.error("Failed to delete note");
    }
  }

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        {searchOpen && (
          <Input
            placeholder="Search notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 flex-1 rounded-lg bg-card shadow-sm ring-1 ring-border/50"
            autoFocus
          />
        )}
        <button
          onClick={() => {
            setSearchOpen((v) => !v);
            if (searchOpen) setSearch("");
          }}
          className="flex size-9 items-center justify-center rounded-lg bg-card shadow-sm ring-1 ring-border/50 transition-colors hover:bg-secondary"
        >
          <Search className="size-4 text-muted-foreground" />
        </button>
        <button
          onClick={() => setSortAsc((v) => !v)}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-card px-3 text-sm font-medium shadow-sm ring-1 ring-border/50 transition-colors hover:bg-secondary"
        >
          {sortAsc ? (
            <ArrowUpAZ className="size-4" />
          ) : (
            <ArrowDownAZ className="size-4" />
          )}
          {sortAsc ? "Oldest" : "Newest"}
        </button>
        <div className="flex-1" />
        <Button className="rounded-lg" onClick={openCreate}>
          <Plus className="mr-2 size-4" />
          New Note
        </Button>
      </div>

      {/* Notes list */}
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="space-y-3 rounded-xl bg-card p-5 shadow-sm ring-1 ring-border/50"
            >
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-4/5" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20">
          <div className="flex size-14 items-center justify-center rounded-full bg-secondary">
            <StickyNote className="size-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            {search
              ? "No notes matching your search."
              : "No notes yet. Create one!"}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((note) => (
            <div
              key={note.id}
              className="group flex cursor-pointer flex-col rounded-xl bg-card p-5 shadow-sm ring-1 ring-border/50 transition-all hover:shadow-md"
              onClick={() => openView(note)}
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <h3 className="text-base font-bold leading-snug">
                  {note.title}
                </h3>
                <NoteMenu
                  note={note}
                  onEdit={startEdit}
                  onDelete={handleDelete}
                />
              </div>
              <p className="flex-1 text-sm leading-relaxed text-muted-foreground line-clamp-3">
                {note.content}
              </p>
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground/70">
                <span>{formatDate(note.updatedAt)}</span>
                {isEdited(note.createdAt, note.updatedAt) && (
                  <Badge
                    variant="secondary"
                    className="rounded-md px-1.5 py-0 text-[10px]"
                  >
                    edited
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!isLoading && totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Unified Note Dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          {/* ── View mode ── */}
          {mode === "view" && activeNote && (
            <>
              <DialogHeader>
                <DialogTitle className="pr-8">{activeNote.title}</DialogTitle>
                <DialogDescription>
                  {formatDate(activeNote.updatedAt)}
                  {isEdited(activeNote.createdAt, activeNote.updatedAt) &&
                    " · edited"}
                </DialogDescription>
              </DialogHeader>
              <p className="max-h-80 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {activeNote.content}
              </p>
              <div className="flex items-center justify-end gap-2 border-t border-border/50 pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  onClick={() => startEdit(activeNote)}
                >
                  <Pencil className="mr-2 size-3.5" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => handleDelete(activeNote.id)}
                >
                  <Trash2 className="mr-2 size-3.5" />
                  Delete
                </Button>
              </div>
            </>
          )}

          {/* ── Edit / Create mode ── */}
          {(mode === "edit" || mode === "create") && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {mode === "edit" ? "Edit Note" : "New Note"}
                </DialogTitle>
                <DialogDescription>
                  {mode === "edit"
                    ? "Update your note below."
                    : "Write down something you want to remember."}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="note-title">Title</Label>
                  <Input
                    id="note-title"
                    placeholder="Note title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="rounded-lg bg-background"
                  />
                  {errors.title && (
                    <p className="text-xs text-destructive">{errors.title}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="note-content">Content</Label>
                  <Textarea
                    id="note-content"
                    placeholder="Write your note..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={6}
                    className="rounded-lg bg-background"
                  />
                  {errors.content && (
                    <p className="text-xs text-destructive">{errors.content}</p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  className="rounded-lg"
                  onClick={cancelEdit}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  className="rounded-lg"
                  onClick={handleSave}
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? "Saving..."
                    : mode === "edit"
                      ? "Save Changes"
                      : "Create"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NoteMenu({
  note,
  onEdit,
  onDelete,
}: {
  note: Note;
  onEdit: (note: Note) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        onClick={(e) => e.stopPropagation()}
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onEdit(note);
          }}
        >
          <Pencil className="size-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(note.id);
          }}
        >
          <Trash2 className="size-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const deadlineSchema = z.object({
  title: z.string().min(1, { message: "Title is required" }).max(200),
  dueAt: z
    .string()
    .min(1, { message: "Due date is required" })
    .refine(
      (value) => {
        const date = new Date(value);
        return !Number.isNaN(date.getTime()) && date.getTime() > Date.now();
      },
      { message: "Due date must be in the future" },
    ),
});

type DeadlineFieldErrors = Partial<
  Record<keyof z.infer<typeof deadlineSchema>, string>
>;

type Urgency = "overdue" | "today" | "tomorrow" | "this-week" | "later";

function getUrgency(dueAt: string): Urgency {
  const due = new Date(dueAt);
  const now = new Date();

  if (due.getTime() < now.getTime()) return "overdue";

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const dayAfterTomorrow = new Date(todayStart);
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
  const weekEnd = new Date(todayStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  if (due < tomorrowStart) return "today";
  if (due < dayAfterTomorrow) return "tomorrow";
  if (due < weekEnd) return "this-week";
  return "later";
}

const URGENCY_LABELS: Record<Urgency, string> = {
  overdue: "Overdue",
  today: "Today",
  tomorrow: "Tomorrow",
  "this-week": "This week",
  later: "Later",
};

const URGENCY_STYLES: Record<Urgency, string> = {
  overdue: "bg-destructive/10 text-destructive",
  today: "bg-amber-100 text-amber-700",
  tomorrow: "bg-accent text-accent-foreground",
  "this-week": "bg-secondary text-secondary-foreground",
  later: "bg-secondary text-muted-foreground",
};

function formatDueAt(dueAt: string): string {
  const date = new Date(dueAt);
  const datePart = date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const timePart = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${datePart} · ${timePart}`;
}

function toDatetimeLocal(iso: string): string {
  // Convert ISO string to value accepted by <input type="datetime-local">
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function DeadlinesTab() {
  const [items, setItems] = useState<Deadline[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [sortAsc, setSortAsc] = useState(true);

  const [activeDeadline, setActiveDeadline] = useState<Deadline | null>(null);
  const [mode, setMode] = useState<"view" | "edit" | "create">("view");
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [errors, setErrors] = useState<DeadlineFieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const dialogOpen = activeDeadline !== null || mode === "create";

  const fetchDeadlines = useCallback(async () => {
    setIsLoading(true);
    try {
      const api = await getApiClient();
      const res = await api.api.deadlines.$get({
        query: { page: "1", pageSize: "50" },
      });
      if (!res.ok) {
        toast.error("Failed to load deadlines");
        return;
      }
      const json = (await res.json()) as DeadlinesListResponse;
      setItems(json.data);
    } catch {
      toast.error("Failed to load deadlines");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDeadlines();
  }, [fetchDeadlines]);

  const filtered = useMemo(() => {
    let result = [...items];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((d) => d.title.toLowerCase().includes(q));
    }
    result.sort((a, b) => {
      const da = new Date(a.dueAt).getTime();
      const db = new Date(b.dueAt).getTime();
      return sortAsc ? da - db : db - da;
    });
    return result;
  }, [items, search, sortAsc]);

  function closeDialog() {
    setActiveDeadline(null);
    setMode("view");
    setTitle("");
    setDueAt("");
    setErrors({});
  }

  function openView(d: Deadline) {
    setActiveDeadline(d);
    setMode("view");
  }

  function openCreate() {
    setActiveDeadline(null);
    setTitle("");
    setDueAt("");
    setErrors({});
    setMode("create");
  }

  function startEdit(d: Deadline) {
    setActiveDeadline(d);
    setTitle(d.title);
    setDueAt(toDatetimeLocal(d.dueAt));
    setErrors({});
    setMode("edit");
  }

  function cancelEdit() {
    if (activeDeadline) {
      setMode("view");
      setErrors({});
    } else {
      closeDialog();
    }
  }

  async function handleSave() {
    const result = deadlineSchema.safeParse({ title, dueAt });
    if (!result.success) {
      const fieldErrors: DeadlineFieldErrors = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof DeadlineFieldErrors;
        if (!fieldErrors[field]) fieldErrors[field] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    const dueDate = new Date(result.data.dueAt);
    if (Number.isNaN(dueDate.getTime())) {
      setErrors({ dueAt: "Invalid date" });
      return;
    }

    setErrors({});
    setIsSubmitting(true);
    try {
      const api = await getApiClient();

      if (mode === "edit" && activeDeadline) {
        const res = await api.api.deadlines[":id"].$patch({
          param: { id: activeDeadline.id },
          json: {
            title: result.data.title,
            dueAt: dueDate.toISOString(),
          },
        });
        if (!res.ok) {
          toast.error("Failed to update deadline");
          return;
        }
        const json = (await res.json()) as { success: true; data: Deadline };
        setActiveDeadline(json.data);
        setMode("view");
        toast.success("Deadline updated");
        fetchDeadlines();
      } else {
        const res = await api.api.deadlines.$post({
          json: {
            title: result.data.title,
            dueAt: dueDate.toISOString(),
          },
        });
        if (!res.ok) {
          toast.error("Failed to create deadline");
          return;
        }
        const json = (await res.json()) as { success: true; data: Deadline };
        setActiveDeadline(json.data);
        setMode("view");
        toast.success("Deadline created");
        fetchDeadlines();
      }
    } catch {
      toast.error(
        mode === "edit"
          ? "Failed to update deadline"
          : "Failed to create deadline",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const api = await getApiClient();
      const res = await api.api.deadlines[":id"].$delete({ param: { id } });
      if (!res.ok) {
        toast.error("Failed to delete deadline");
        return;
      }
      toast.success("Deadline deleted");
      closeDialog();
      fetchDeadlines();
    } catch {
      toast.error("Failed to delete deadline");
    }
  }

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        {searchOpen && (
          <Input
            placeholder="Search deadlines..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 flex-1 rounded-lg bg-card shadow-sm ring-1 ring-border/50"
            autoFocus
          />
        )}
        <button
          onClick={() => {
            setSearchOpen((v) => !v);
            if (searchOpen) setSearch("");
          }}
          className="flex size-9 items-center justify-center rounded-lg bg-card shadow-sm ring-1 ring-border/50 transition-colors hover:bg-secondary"
        >
          <Search className="size-4 text-muted-foreground" />
        </button>
        <button
          onClick={() => setSortAsc((v) => !v)}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-card px-3 text-sm font-medium shadow-sm ring-1 ring-border/50 transition-colors hover:bg-secondary"
        >
          {sortAsc ? (
            <ArrowUpAZ className="size-4" />
          ) : (
            <ArrowDownAZ className="size-4" />
          )}
          {sortAsc ? "Soonest" : "Latest"}
        </button>
        <div className="flex-1" />
        <Button className="rounded-lg" onClick={openCreate}>
          <Plus className="mr-2 size-4" />
          New Deadline
        </Button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 rounded-xl bg-card p-5 shadow-sm ring-1 ring-border/50"
            >
              <Skeleton className="size-11 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-3.5 w-1/3" />
              </div>
              <Skeleton className="h-6 w-16 rounded-md" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20">
          <div className="flex size-14 items-center justify-center rounded-full bg-secondary">
            <CalendarClock className="size-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            {search
              ? "No deadlines matching your search."
              : "No deadlines yet. Create one!"}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((d) => {
            const urgency = getUrgency(d.dueAt);
            return (
              <div
                key={d.id}
                className="group flex cursor-pointer items-center gap-4 rounded-xl bg-card p-5 shadow-sm ring-1 ring-border/50 transition-all hover:shadow-md"
                onClick={() => openView(d)}
              >
                <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary">
                  <CalendarClock className="size-5 text-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-base font-bold leading-snug">
                    {d.title}
                  </h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {formatDueAt(d.dueAt)}
                  </p>
                </div>
                <Badge
                  className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] ${URGENCY_STYLES[urgency]}`}
                >
                  {URGENCY_LABELS[urgency]}
                </Badge>
                <DeadlineMenu
                  deadline={d}
                  onEdit={startEdit}
                  onDelete={handleDelete}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Unified Deadline Dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          {/* ── View mode ── */}
          {mode === "view" && activeDeadline && (
            <>
              <DialogHeader>
                <DialogTitle className="pr-8">
                  {activeDeadline.title}
                </DialogTitle>
                <DialogDescription>
                  Due {formatDueAt(activeDeadline.dueAt)}
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-center gap-2">
                <Badge
                  className={`rounded-md px-2 py-0.5 text-[10px] ${URGENCY_STYLES[getUrgency(activeDeadline.dueAt)]}`}
                >
                  {URGENCY_LABELS[getUrgency(activeDeadline.dueAt)]}
                </Badge>
                {activeDeadline.reminderEmailId && (
                  <span className="text-xs text-muted-foreground">
                    · Reminder scheduled 24h before
                  </span>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-border/50 pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  onClick={() => startEdit(activeDeadline)}
                >
                  <Pencil className="mr-2 size-3.5" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => handleDelete(activeDeadline.id)}
                >
                  <Trash2 className="mr-2 size-3.5" />
                  Delete
                </Button>
              </div>
            </>
          )}

          {/* ── Edit / Create mode ── */}
          {(mode === "edit" || mode === "create") && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {mode === "edit" ? "Edit Deadline" : "New Deadline"}
                </DialogTitle>
                <DialogDescription>
                  {mode === "edit"
                    ? "Update your deadline below."
                    : "Set a new deadline and get a reminder 24h before."}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="deadline-title">Title</Label>
                  <Input
                    id="deadline-title"
                    placeholder="Deadline title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="rounded-lg bg-background"
                  />
                  {errors.title && (
                    <p className="text-xs text-destructive">{errors.title}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deadline-due-at">Due date</Label>
                  <Input
                    id="deadline-due-at"
                    type="datetime-local"
                    min={toDatetimeLocal(new Date().toISOString())}
                    value={dueAt}
                    onChange={(e) => setDueAt(e.target.value)}
                    className="rounded-lg bg-background"
                  />
                  {errors.dueAt && (
                    <p className="text-xs text-destructive">{errors.dueAt}</p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  className="rounded-lg"
                  onClick={cancelEdit}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  className="rounded-lg"
                  onClick={handleSave}
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? "Saving..."
                    : mode === "edit"
                      ? "Save Changes"
                      : "Create"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DeadlineMenu({
  deadline,
  onEdit,
  onDelete,
}: {
  deadline: Deadline;
  onEdit: (d: Deadline) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        onClick={(e) => e.stopPropagation()}
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onEdit(deadline);
          }}
        >
          <Pencil className="size-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(deadline.id);
          }}
        >
          <Trash2 className="size-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
