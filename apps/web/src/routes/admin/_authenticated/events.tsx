import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { formatDate, formatTime, isEdited } from "@/lib/utils";
import { toast } from "sonner";
import { z } from "zod";
import type { InferResponseType } from "hono/client";
import { hc } from "hono/client";

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { getApiClient } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { env } from "@my-better-t-app/env/web";
import type { AppType } from "server";

type Client = ReturnType<typeof hc<AppType>>;
type ListEndpoint = Client["api"]["admin"]["events"]["$get"];
type ListResponse = Extract<InferResponseType<ListEndpoint>, { success: true }>;
type EventItem = ListResponse["data"][number];

type DetailEndpoint = Client["api"]["admin"]["events"][":id"]["$get"];
type DetailResponse = Extract<InferResponseType<DetailEndpoint>, { success: true }>;
type EventDetail = DetailResponse["data"];
type Registration = EventDetail["registrations"][number];

export const Route = createFileRoute("/admin/_authenticated/events")({
  component: EventsPage,
});

const eventSchema = z.object({
  title: z.string().min(1, { message: "Title is required" }).max(200),
  description: z.string().min(1, { message: "Description is required" }),
  eventDate: z.string().min(1, { message: "Date and time are required" }),
  location: z.string().min(1, { message: "Location is required" }).max(300),
  maxParticipants: z.coerce.number({ message: "Must be a number" }).int().positive({ message: "Must be at least 1" }),
});

type FieldErrors = Partial<Record<keyof z.infer<typeof eventSchema>, string>>;

function EventsPage() {
  const [eventsList, setEventsList] = useState<EventItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedEvent, setSelectedEvent] = useState<EventDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Create/Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [location, setLocation] = useState("");
  const [maxParticipants, setMaxParticipants] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const totalPages = Math.ceil(total / pageSize);
  const isEditing = editingId !== null;

  const fetchEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      const api = await getApiClient();
      const res = await api.api.admin.events.$get({ query: { page: String(page), pageSize: String(pageSize) } });
      if (!res.ok) { toast.error("Failed to load events"); return; }
      const json = (await res.json()) as ListResponse;
      setEventsList(json.data);
      setTotal(json.total);
    } catch { toast.error("Failed to load events"); }
    finally { setIsLoading(false); }
  }, [page, pageSize]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  async function fetchEventDetail(id: string) {
    // Registrations are loaded on demand so the main list stays cheap when admins only need event CRUD.
    setIsLoadingDetail(true);
    try {
      const api = await getApiClient();
      const res = await api.api.admin.events[":id"].$get({ param: { id } });
      if (!res.ok) { toast.error("Failed to load event details"); return; }
      const json = (await res.json()) as DetailResponse;
      setSelectedEvent(json.data);
    } catch { toast.error("Failed to load event details"); }
    finally { setIsLoadingDetail(false); }
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setImageFile(file);
    // Revoke the previous blob URL immediately to avoid leaking previews during repeated image edits.
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(file ? URL.createObjectURL(file) : null);
    if (file) setExistingImageUrl(null);
  }

  function resetForm() {
    setEditingId(null); setTitle(""); setDescription(""); setEventDate(""); setLocation(""); setMaxParticipants("");
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null); setExistingImageUrl(null); setErrors({});
  }

  function openCreateDialog() {
    resetForm();
    setDialogOpen(true);
  }

  function openEditDialog(event: EventItem) {
    resetForm();
    setEditingId(event.id);
    setTitle(event.title);
    setDescription(event.description);
    setEventDate(new Date(event.eventDate).toISOString().slice(0, 16));
    setLocation(event.location);
    setMaxParticipants(String(event.maxParticipants));
    setExistingImageUrl(event.imageUrl);
    setDialogOpen(true);
  }

  function openDeleteDialog(id: string) {
    setDeleteTargetId(id);
    setDeleteDialogOpen(true);
  }

  async function handleSubmit() {
    const result = eventSchema.safeParse({ title, description, eventDate, location, maxParticipants });
    if (!result.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of result.error.issues) { const field = issue.path[0] as keyof FieldErrors; if (!fieldErrors[field]) fieldErrors[field] = issue.message; }
      setErrors(fieldErrors); return;
    }
    setErrors({}); setIsSubmitting(true);

    try {
      let imageUrl: string | undefined | null = existingImageUrl;

      if (imageFile) {
        // Upload is kept outside the typed API client because this endpoint accepts multipart form data.
        const { data: { session } } = await supabase.auth.getSession();
        const formData = new FormData(); formData.append("image", imageFile);
        const uploadRes = await fetch(`${env.VITE_SERVER_URL}/api/admin/events/upload-image`, { method: "POST", headers: { Authorization: `Bearer ${session?.access_token}` }, body: formData });
        if (!uploadRes.ok) { toast.error("Failed to upload image"); return; }
        const uploadJson = await uploadRes.json(); imageUrl = uploadJson.data.imageUrl;
      }

      const api = await getApiClient();

      // Create and edit share one payload builder so validation and image handling stay aligned.
      if (isEditing) {
        const res = await api.api.admin.events[":id"].$patch({
          param: { id: editingId },
          json: {
            title: result.data.title,
            description: result.data.description,
            eventDate: new Date(result.data.eventDate).toISOString(),
            location: result.data.location,
            maxParticipants: result.data.maxParticipants,
            imageUrl: imageUrl ?? null,
          },
        });
        if (!res.ok) { toast.error("Failed to update event"); return; }
        toast.success("Event updated");
      } else {
        const res = await api.api.admin.events.$post({
          json: {
            title: result.data.title,
            description: result.data.description,
            eventDate: new Date(result.data.eventDate).toISOString(),
            location: result.data.location,
            maxParticipants: result.data.maxParticipants,
            ...(imageUrl ? { imageUrl } : {}),
          },
        });
        if (!res.ok) { toast.error("Failed to create event"); return; }
        toast.success("Event created");
      }

      setDialogOpen(false); resetForm(); fetchEvents();
    } catch { toast.error(isEditing ? "Failed to update event" : "Failed to create event"); }
    finally { setIsSubmitting(false); }
  }

  async function handleDelete() {
    if (!deleteTargetId) return;
    setIsDeleting(true);
    try {
      const api = await getApiClient();
      const res = await api.api.admin.events[":id"].$delete({ param: { id: deleteTargetId } });
      if (!res.ok) { toast.error("Failed to delete event"); return; }
      toast.success("Event deleted");
      setDeleteDialogOpen(false); setDeleteTargetId(null);
      // Clear the side-panel detail if the deleted event was the one currently being inspected.
      if (selectedEvent?.id === deleteTargetId) setSelectedEvent(null);
      fetchEvents();
    } catch { toast.error("Failed to delete event"); }
    finally { setIsDeleting(false); }
  }

  const currentPreview = imagePreview ?? existingImageUrl;
  const tableHeadClass = "px-4 py-3 text-left text-xs font-semibold text-muted-foreground";
  const tableCellClass = "px-4 py-3";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Event Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create and manage university events.</p>
        </div>
        <Button className="rounded-lg" onClick={openCreateDialog}>
          <Plus className="mr-2 size-4" />
          Create Event
        </Button>
      </div>

      <Tabs defaultValue="events">
        <TabsList>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="registrations">Registrations</TabsTrigger>
        </TabsList>

        <TabsContent value="events" className="mt-4">
          <div className="overflow-hidden rounded-xl bg-card shadow-sm ring-1 ring-border/50">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-secondary/50">
                  <th className={tableHeadClass}>Title</th>
                  <th className={tableHeadClass}>Date</th>
                  <th className={tableHeadClass}>Location</th>
                  <th className={tableHeadClass}>Registered</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/30">
                      <td className={tableCellClass}><Skeleton className="h-4 w-40" /></td>
                      <td className={tableCellClass}><Skeleton className="h-4 w-24" /></td>
                      <td className={tableCellClass}><Skeleton className="h-4 w-28" /></td>
                      <td className={tableCellClass}><Skeleton className="h-4 w-16" /></td>
                      <td className={tableCellClass}><Skeleton className="ml-auto h-4 w-16" /></td>
                    </tr>
                  ))
                ) : eventsList.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-16 text-center text-sm text-muted-foreground">No events yet. Create your first one.</td></tr>
                ) : (
                  eventsList.map((event) => (
                    <tr key={event.id} className="border-b border-border/30 last:border-0">
                      <td className={`${tableCellClass} font-medium`}>{event.title}</td>
                      <td className={`${tableCellClass} text-muted-foreground`}>
                        {formatDate(event.eventDate)} · {formatTime(event.eventDate)}
                        {event.updatedAt && isEdited(event.createdAt, event.updatedAt) && (
                          <span className="text-muted-foreground/50"> · Edited</span>
                        )}
                      </td>
                      <td className={`${tableCellClass} text-muted-foreground`}>{event.location}</td>
                      <td className={`${tableCellClass} text-muted-foreground`}>{event.registrationCount} / {event.maxParticipants}</td>
                      <td className={`${tableCellClass} text-right`}>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => openEditDialog(event)}
                            title="Edit"
                            className="text-muted-foreground hover:bg-secondary hover:text-foreground"
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => openDeleteDialog(event.id)}
                            title="Delete"
                            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {!isLoading && totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="rounded-lg" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                <Button variant="outline" size="sm" className="rounded-lg" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="registrations" className="mt-4">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {eventsList.map((event) => (
                <Button
                  key={event.id}
                  variant={selectedEvent?.id === event.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => fetchEventDetail(event.id)}
                  className={selectedEvent?.id === event.id ? "rounded-lg" : "rounded-lg border-border/50 bg-card text-muted-foreground hover:bg-secondary"}
                >
                  {event.title}
                </Button>
              ))}
              {eventsList.length === 0 && !isLoading && <p className="text-sm text-muted-foreground">No events to show registrations for.</p>}
            </div>

            {isLoadingDetail ? (
              <div className="overflow-hidden rounded-xl bg-card shadow-sm ring-1 ring-border/50">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border/50 bg-secondary/50"><th className={tableHeadClass}>Name</th><th className={tableHeadClass}>Email</th><th className={tableHeadClass}>Group</th><th className={tableHeadClass}>Registered</th></tr></thead>
                  <tbody>{Array.from({ length: 3 }).map((_, i) => (<tr key={i} className="border-b border-border/30"><td className={tableCellClass}><Skeleton className="h-4 w-32" /></td><td className={tableCellClass}><Skeleton className="h-4 w-40" /></td><td className={tableCellClass}><Skeleton className="h-4 w-20" /></td><td className={tableCellClass}><Skeleton className="h-4 w-24" /></td></tr>))}</tbody>
                </table>
              </div>
            ) : selectedEvent ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">{selectedEvent.title} — {selectedEvent.registrationCount} / {selectedEvent.maxParticipants} registered</p>
                <div className="overflow-hidden rounded-xl bg-card shadow-sm ring-1 ring-border/50">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-border/50 bg-secondary/50"><th className={tableHeadClass}>Name</th><th className={tableHeadClass}>Email</th><th className={tableHeadClass}>Group</th><th className={tableHeadClass}>Registered At</th></tr></thead>
                    <tbody>
                      {selectedEvent.registrations.length === 0 ? (
                        <tr><td colSpan={4} className="px-4 py-16 text-center text-sm text-muted-foreground">No registrations yet.</td></tr>
                      ) : (
                        selectedEvent.registrations.map((reg: Registration) => (
                          <tr key={reg.id} className="border-b border-border/30 last:border-0">
                            <td className={`${tableCellClass} font-medium`}>{reg.studentName ?? "—"}</td>
                            <td className={`${tableCellClass} text-muted-foreground`}>{reg.studentEmail}</td>
                            <td className={tableCellClass}>{reg.group ?? "—"}</td>
                            <td className={`${tableCellClass} text-muted-foreground`}>{formatDate(reg.registeredAt)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">Select an event above to view registrations.</p>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Event" : "Create Event"}</DialogTitle>
            <DialogDescription>{isEditing ? "Update the event details." : "Add a new university event. Students will be able to register."}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="event-title">Title</Label>
              <Input id="event-title" placeholder="Enter event title..." value={title} onChange={(e) => setTitle(e.target.value)} className="rounded-lg bg-background" />
              {errors.title && <p className="text-xs text-destructive">{errors.title}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-description">Description</Label>
              <Textarea id="event-description" placeholder="Describe the event..." value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="rounded-lg bg-background" />
              {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="event-date">Date & Time</Label>
                <Input id="event-date" type="datetime-local" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="rounded-lg bg-background" />
                {errors.eventDate && <p className="text-xs text-destructive">{errors.eventDate}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-max">Max Participants</Label>
                <Input id="event-max" type="number" min={1} placeholder="50" value={maxParticipants} onChange={(e) => setMaxParticipants(e.target.value)} className="rounded-lg bg-background" />
                {errors.maxParticipants && <p className="text-xs text-destructive">{errors.maxParticipants}</p>}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-location">Location</Label>
              <Input id="event-location" placeholder="Building, room, or address..." value={location} onChange={(e) => setLocation(e.target.value)} className="rounded-lg bg-background" />
              {errors.location && <p className="text-xs text-destructive">{errors.location}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-image">Image (optional)</Label>
              <Input id="event-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageChange} className="rounded-lg bg-background" />
              {currentPreview && (
                <div className="relative mt-2">
                  <img src={currentPreview} alt="Preview" className="max-h-48 rounded-xl object-cover" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => { setImageFile(null); if (imagePreview) URL.revokeObjectURL(imagePreview); setImagePreview(null); setExistingImageUrl(null); }}
                    className="absolute top-2 right-2 rounded-full bg-foreground/70 text-background hover:bg-foreground hover:text-background"
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" className="rounded-lg" onClick={() => setDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
            <Button className="rounded-lg" onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (isEditing ? "Saving..." : "Creating...") : (isEditing ? "Save Changes" : "Create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Event"
        description="Are you sure you want to delete this event? All registrations will be removed. This action cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        isPending={isDeleting}
      />
    </div>
  );
}
