import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownAZ, ArrowUpAZ, Pencil, StickyNote, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { getApiClient } from "@/lib/api";
import { formatDate, isEdited } from "@/lib/utils";

import { ItemActionsMenu, ListToolbar, mapZodIssuesToFieldErrors } from "./shared";
import type { Note, NotesListData } from "./types";
import { useCrudDialogState } from "./use-crud-dialog-state";

const noteSchema = z.object({
  title: z.string().min(1, { message: "Title is required" }).max(200),
  content: z.string().min(1, { message: "Content is required" }).max(5000),
});

type NoteField = keyof z.infer<typeof noteSchema>;
type NoteFieldErrors = Partial<Record<NoteField, string>>;

export function NotesTab() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [isLoading, setIsLoading] = useState(true);

  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [sortAsc, setSortAsc] = useState(false);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [errors, setErrors] = useState<NoteFieldErrors>({});

  const {
    activeItem: activeNote,
    setActiveItem: setActiveNote,
    mode,
    setMode,
    pendingDeleteId,
    setPendingDeleteId,
    isSubmitting,
    setIsSubmitting,
    isDeleting,
    setIsDeleting,
    dialogOpen,
    closeDialog,
    openView,
    openCreate,
    startEdit,
    cancelEdit,
    requestDelete,
  } = useCrudDialogState<Note>();

  const totalPages = Math.ceil(total / pageSize);

  const fetchNotes = useCallback(async () => {
    setIsLoading(true);
    try {
      const api = await getApiClient();
      const response = await api.api.notes.$get({
        query: { page: String(page), pageSize: String(pageSize) },
      });
      if (!response.ok) {
        toast.error("Failed to load notes");
        return;
      }

      const json = (await response.json()) as NotesListData;
      setNotes(json.data);
      setTotal(json.total);
    } catch {
      toast.error("Failed to load notes");
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const filteredNotes = useMemo(() => {
    // Search and sort stay local so paging is still controlled by the server response.
    let result = [...notes];
    if (search) {
      const query = search.toLowerCase();
      result = result.filter(
        (note) =>
          note.title.toLowerCase().includes(query) ||
          note.content.toLowerCase().includes(query),
      );
    }

    result.sort((left, right) => {
      const leftDate = new Date(left.updatedAt).getTime();
      const rightDate = new Date(right.updatedAt).getTime();
      return sortAsc ? leftDate - rightDate : rightDate - leftDate;
    });

    return result;
  }, [notes, search, sortAsc]);

  function resetForm() {
    setTitle("");
    setContent("");
    setErrors({});
  }

  function handleCloseDialog() {
    closeDialog();
    resetForm();
  }

  function handleOpenView(note: Note) {
    openView(note);
    resetForm();
  }

  function handleOpenCreate() {
    openCreate();
    resetForm();
  }

  function handleStartEdit(note: Note) {
    startEdit(note);
    setTitle(note.title);
    setContent(note.content);
    setErrors({});
  }

  function handleCancelEdit() {
    setErrors({});
    // If edit started from the detail view, return there instead of dropping the selected note.
    if (activeNote) {
      cancelEdit();
      return;
    }

    handleCloseDialog();
  }

  async function handleSave() {
    const result = noteSchema.safeParse({ title, content });
    if (!result.success) {
      setErrors(mapZodIssuesToFieldErrors<NoteField>(result.error.issues));
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      const api = await getApiClient();

      // Share one submit path so create and edit stay consistent about validation and pending state.
      if (mode === "edit" && activeNote) {
        const response = await api.api.notes[":id"].$patch({
          param: { id: activeNote.id },
          json: {
            title: result.data.title,
            content: result.data.content,
          },
        });
        if (!response.ok) {
          toast.error("Failed to update note");
          return;
        }

        const json = (await response.json()) as { success: true; data: Note };
        setActiveNote(json.data);
        setMode("view");
        toast.success("Note updated");
        fetchNotes();
        return;
      }

      const response = await api.api.notes.$post({
        json: {
          title: result.data.title,
          content: result.data.content,
        },
      });
      if (!response.ok) {
        toast.error("Failed to create note");
        return;
      }

      const json = (await response.json()) as { success: true; data: Note };
      setActiveNote(json.data);
      setMode("view");
      toast.success("Note created");
      fetchNotes();
    } catch {
      toast.error(
        mode === "edit" ? "Failed to update note" : "Failed to create note",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDeleteId) return;

    setIsDeleting(true);
    try {
      const api = await getApiClient();
      const response = await api.api.notes[":id"].$delete({
        param: { id: pendingDeleteId },
      });
      if (!response.ok) {
        toast.error("Failed to delete note");
        return;
      }

      toast.success("Note deleted");
      setPendingDeleteId(null);
      handleCloseDialog();
      fetchNotes();
    } catch {
      toast.error("Failed to delete note");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-5">
      <ListToolbar
        searchOpen={searchOpen}
        searchValue={search}
        searchPlaceholder="Search notes..."
        searchButtonLabel={
          searchOpen ? "Close notes search" : "Open notes search"
        }
        sortButtonLabel="Sort notes by last updated"
        sortButtonText={sortAsc ? "Oldest" : "Newest"}
        sortIcon={
          sortAsc ? (
            <ArrowUpAZ className="size-4" />
          ) : (
            <ArrowDownAZ className="size-4" />
          )
        }
        createButtonLabel="New Note"
        onSearchChange={setSearch}
        onSearchToggle={() => {
          setSearchOpen((value) => !value);
          if (searchOpen) setSearch("");
        }}
        onSortToggle={() => setSortAsc((value) => !value)}
        onCreate={handleOpenCreate}
      />

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="space-y-3 rounded-xl bg-card p-5 shadow-sm ring-1 ring-border/50"
            >
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-4/5" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          ))}
        </div>
      ) : filteredNotes.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20">
          <div className="flex size-14 items-center justify-center rounded-full bg-secondary">
            <StickyNote className="size-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            {search ? "No notes matching your search." : "No notes yet. Create one!"}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredNotes.map((note) => (
            <div
              key={note.id}
              className="group flex cursor-pointer flex-col rounded-xl bg-card p-5 shadow-sm ring-1 ring-border/50 transition-all hover:shadow-md"
              onClick={() => handleOpenView(note)}
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <h3 className="text-base font-bold leading-snug">{note.title}</h3>
                <ItemActionsMenu
                  itemLabel={note.title}
                  onEdit={() => handleStartEdit(note)}
                  onDelete={() => requestDelete(note.id)}
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
              onClick={() => setPage((value) => value - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg"
              disabled={page >= totalPages}
              onClick={() => setPage((value) => value + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) handleCloseDialog();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          {mode === "view" && activeNote && (
            <>
              <DialogHeader>
                <DialogTitle className="pr-8">{activeNote.title}</DialogTitle>
                <DialogDescription>
                  {formatDate(activeNote.updatedAt)}
                  {isEdited(activeNote.createdAt, activeNote.updatedAt) &&
                    " - edited"}
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
                  onClick={() => handleStartEdit(activeNote)}
                >
                  <Pencil className="mr-2 size-3.5" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => requestDelete(activeNote.id)}
                >
                  <Trash2 className="mr-2 size-3.5" />
                  Delete
                </Button>
              </div>
            </>
          )}

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
                    onChange={(event) => setTitle(event.target.value)}
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
                    onChange={(event) => setContent(event.target.value)}
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
                  onClick={handleCancelEdit}
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

      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteId(null);
        }}
        title="Delete Note"
        description="Are you sure you want to delete this note? This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        isPending={isDeleting}
      />
    </div>
  );
}
