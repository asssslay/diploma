import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownAZ, ArrowUpAZ, CalendarClock, Pencil, Trash2 } from "lucide-react";
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
import { getApiClient } from "@/lib/api";

import {
  formatDueAt,
  getReminderSummary,
  getUrgency,
  toDatetimeLocal,
  URGENCY_LABELS,
  URGENCY_STYLES,
} from "./deadlines-helpers";
import { ItemActionsMenu, ListToolbar, mapZodIssuesToFieldErrors } from "./shared";
import type { Deadline, DeadlinesListData } from "./types";
import { useCrudDialogState } from "./use-crud-dialog-state";

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

type DeadlineField = keyof z.infer<typeof deadlineSchema>;
type DeadlineFieldErrors = Partial<Record<DeadlineField, string>>;

export function DeadlinesTab() {
  const [items, setItems] = useState<Deadline[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [sortAsc, setSortAsc] = useState(true);

  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [errors, setErrors] = useState<DeadlineFieldErrors>({});

  const {
    activeItem: activeDeadline,
    setActiveItem: setActiveDeadline,
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
  } = useCrudDialogState<Deadline>();

  const fetchDeadlines = useCallback(async () => {
    setIsLoading(true);
    try {
      const api = await getApiClient();
      const response = await api.api.deadlines.$get({
        query: { page: "1", pageSize: "50" },
      });
      if (!response.ok) {
        toast.error("Failed to load deadlines");
        return;
      }

      const json = (await response.json()) as DeadlinesListData;
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

  const filteredDeadlines = useMemo(() => {
    let result = [...items];
    if (search) {
      const query = search.toLowerCase();
      result = result.filter((deadline) =>
        deadline.title.toLowerCase().includes(query),
      );
    }

    result.sort((left, right) => {
      const leftDate = new Date(left.dueAt).getTime();
      const rightDate = new Date(right.dueAt).getTime();
      return sortAsc ? leftDate - rightDate : rightDate - leftDate;
    });

    return result;
  }, [items, search, sortAsc]);

  const activeDeadlineUrgency = activeDeadline
    ? getUrgency(activeDeadline.dueAt)
    : null;
  const activeDeadlineReminderSummary = activeDeadline
    ? getReminderSummary(activeDeadline)
    : "";

  function resetForm() {
    setTitle("");
    setDueAt("");
    setErrors({});
  }

  function handleCloseDialog() {
    closeDialog();
    resetForm();
  }

  function handleOpenView(deadline: Deadline) {
    openView(deadline);
    resetForm();
  }

  function handleOpenCreate() {
    openCreate();
    resetForm();
  }

  function handleStartEdit(deadline: Deadline) {
    startEdit(deadline);
    setTitle(deadline.title);
    setDueAt(toDatetimeLocal(deadline.dueAt));
    setErrors({});
  }

  function handleCancelEdit() {
    setErrors({});
    if (activeDeadline) {
      cancelEdit();
      return;
    }

    handleCloseDialog();
  }

  async function handleSave() {
    const result = deadlineSchema.safeParse({ title, dueAt });
    if (!result.success) {
      setErrors(mapZodIssuesToFieldErrors<DeadlineField>(result.error.issues));
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
      const dueAtIso = dueDate.toISOString();

      if (mode === "edit" && activeDeadline) {
        const response = await api.api.deadlines[":id"].$patch({
          param: { id: activeDeadline.id },
          json: {
            title: result.data.title,
            dueAt: dueAtIso,
          },
        });
        if (!response.ok) {
          toast.error("Failed to update deadline");
          return;
        }

        const json = (await response.json()) as {
          success: true;
          data: Deadline;
        };
        setActiveDeadline(json.data);
        setMode("view");
        toast.success("Deadline updated");
        fetchDeadlines();
        return;
      }

      const response = await api.api.deadlines.$post({
        json: {
          title: result.data.title,
          dueAt: dueAtIso,
        },
      });
      if (!response.ok) {
        toast.error("Failed to create deadline");
        return;
      }

      const json = (await response.json()) as { success: true; data: Deadline };
      setActiveDeadline(json.data);
      setMode("view");
      toast.success("Deadline created");
      fetchDeadlines();
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

  async function confirmDelete() {
    if (!pendingDeleteId) return;

    setIsDeleting(true);
    try {
      const api = await getApiClient();
      const response = await api.api.deadlines[":id"].$delete({
        param: { id: pendingDeleteId },
      });
      if (!response.ok) {
        toast.error("Failed to delete deadline");
        return;
      }

      toast.success("Deadline deleted");
      setPendingDeleteId(null);
      handleCloseDialog();
      fetchDeadlines();
    } catch {
      toast.error("Failed to delete deadline");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-5">
      <ListToolbar
        searchOpen={searchOpen}
        searchValue={search}
        searchPlaceholder="Search deadlines..."
        searchButtonLabel={
          searchOpen ? "Close deadlines search" : "Open deadlines search"
        }
        sortButtonLabel="Sort deadlines by due date"
        sortButtonText={sortAsc ? "Soonest" : "Latest"}
        sortIcon={
          sortAsc ? (
            <ArrowUpAZ className="size-4" />
          ) : (
            <ArrowDownAZ className="size-4" />
          )
        }
        createButtonLabel="New Deadline"
        onSearchChange={setSearch}
        onSearchToggle={() => {
          setSearchOpen((value) => !value);
          if (searchOpen) setSearch("");
        }}
        onSortToggle={() => setSortAsc((value) => !value)}
        onCreate={handleOpenCreate}
      />

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
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
      ) : filteredDeadlines.length === 0 ? (
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
          {filteredDeadlines.map((deadline) => {
            const urgency = getUrgency(deadline.dueAt);

            return (
              <div
                key={deadline.id}
                className="group flex cursor-pointer items-center gap-4 rounded-xl bg-card p-5 shadow-sm ring-1 ring-border/50 transition-all hover:shadow-md"
                onClick={() => handleOpenView(deadline)}
              >
                <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary">
                  <CalendarClock className="size-5 text-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-base font-bold leading-snug">
                    {deadline.title}
                  </h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {formatDueAt(deadline.dueAt)}
                  </p>
                </div>
                <Badge
                  className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] ${URGENCY_STYLES[urgency]}`}
                >
                  {URGENCY_LABELS[urgency]}
                </Badge>
                <ItemActionsMenu
                  itemLabel={deadline.title}
                  onEdit={() => handleStartEdit(deadline)}
                  onDelete={() => requestDelete(deadline.id)}
                />
              </div>
            );
          })}
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) handleCloseDialog();
        }}
      >
        <DialogContent className="sm:max-w-lg">
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
                  className={`rounded-md px-2 py-0.5 text-[10px] ${URGENCY_STYLES[activeDeadlineUrgency!]}`}
                >
                  {URGENCY_LABELS[activeDeadlineUrgency!]}
                </Badge>
                {activeDeadlineReminderSummary && (
                  <span className="text-xs text-muted-foreground">
                    Reminders {activeDeadlineReminderSummary} before
                  </span>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 border-t border-border/50 pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  onClick={() => handleStartEdit(activeDeadline)}
                >
                  <Pencil className="mr-2 size-3.5" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => requestDelete(activeDeadline.id)}
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
                    onChange={(event) => setTitle(event.target.value)}
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
                    onChange={(event) => setDueAt(event.target.value)}
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
        title="Delete Deadline"
        description="Are you sure you want to delete this deadline? Any scheduled reminder emails will also be cancelled. This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        isPending={isDeleting}
      />
    </div>
  );
}
