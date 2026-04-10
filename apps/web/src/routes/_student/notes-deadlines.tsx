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
        <h1 className="text-2xl font-bold tracking-tight">
          Notes & Deadlines
        </h1>
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
          <div className="flex flex-col items-center gap-3 py-20">
            <div className="flex size-14 items-center justify-center rounded-full bg-secondary">
              <CalendarClock className="size-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              Deadlines coming soon.
            </p>
          </div>
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
      toast.error(mode === "edit" ? "Failed to update note" : "Failed to create note");
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
                <DialogTitle className="pr-8">
                  {activeNote.title}
                </DialogTitle>
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
                    <p className="text-xs text-destructive">
                      {errors.content}
                    </p>
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
