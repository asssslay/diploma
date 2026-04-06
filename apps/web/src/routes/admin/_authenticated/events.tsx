import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import type { InferResponseType } from "hono/client";
import { hc } from "hono/client";

import { Button } from "@/components/ui/button";
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

const createEventSchema = z.object({
  title: z.string().min(1, { message: "Title is required" }).max(200),
  description: z.string().min(1, { message: "Description is required" }),
  eventDate: z.string().min(1, { message: "Date and time are required" }),
  location: z.string().min(1, { message: "Location is required" }).max(300),
  maxParticipants: z.coerce.number({ message: "Must be a number" }).int().positive({ message: "Must be at least 1" }),
});

type FieldErrors = Partial<Record<keyof z.infer<typeof createEventSchema>, string>>;

function EventsPage() {
  const [eventsList, setEventsList] = useState<EventItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedEvent, setSelectedEvent] = useState<EventDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [location, setLocation] = useState("");
  const [maxParticipants, setMaxParticipants] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalPages = Math.ceil(total / pageSize);

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
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(file ? URL.createObjectURL(file) : null);
  }

  function resetForm() {
    setTitle(""); setDescription(""); setEventDate(""); setLocation(""); setMaxParticipants("");
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null); setErrors({});
  }

  async function handleCreate() {
    const result = createEventSchema.safeParse({ title, description, eventDate, location, maxParticipants });
    if (!result.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of result.error.issues) { const field = issue.path[0] as keyof FieldErrors; if (!fieldErrors[field]) fieldErrors[field] = issue.message; }
      setErrors(fieldErrors); return;
    }
    setErrors({}); setIsSubmitting(true);
    try {
      let imageUrl: string | undefined;
      if (imageFile) {
        const { data: { session } } = await supabase.auth.getSession();
        const formData = new FormData(); formData.append("image", imageFile);
        const uploadRes = await fetch(`${env.VITE_SERVER_URL}/api/admin/events/upload-image`, { method: "POST", headers: { Authorization: `Bearer ${session?.access_token}` }, body: formData });
        if (!uploadRes.ok) { toast.error("Failed to upload image"); return; }
        const uploadJson = await uploadRes.json(); imageUrl = uploadJson.data.imageUrl;
      }
      const api = await getApiClient();
      const res = await api.api.admin.events.$post({ json: { title: result.data.title, description: result.data.description, eventDate: new Date(result.data.eventDate).toISOString(), location: result.data.location, maxParticipants: result.data.maxParticipants, ...(imageUrl ? { imageUrl } : {}) } });
      if (!res.ok) { toast.error("Failed to create event"); return; }
      toast.success("Event created"); setCreateDialogOpen(false); resetForm(); fetchEvents();
    } catch { toast.error("Failed to create event"); }
    finally { setIsSubmitting(false); }
  }

  const tableHeadClass = "px-4 py-3 text-left text-xs font-semibold text-muted-foreground";
  const tableCellClass = "px-4 py-3";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Event Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create and manage university events.</p>
        </div>
        <Button className="rounded-lg" onClick={() => setCreateDialogOpen(true)}>
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
                    </tr>
                  ))
                ) : eventsList.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-16 text-center text-sm text-muted-foreground">No events yet. Create your first one.</td></tr>
                ) : (
                  eventsList.map((event) => (
                    <tr key={event.id} className="border-b border-border/30 last:border-0">
                      <td className={`${tableCellClass} font-medium`}>{event.title}</td>
                      <td className={`${tableCellClass} text-muted-foreground`}>{new Date(event.eventDate).toLocaleDateString()}</td>
                      <td className={`${tableCellClass} text-muted-foreground`}>{event.location}</td>
                      <td className={`${tableCellClass} text-muted-foreground`}>{event.registrationCount} / {event.maxParticipants}</td>
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
                <button
                  key={event.id}
                  onClick={() => fetchEventDetail(event.id)}
                  className={`h-8 rounded-lg px-3 text-sm font-medium transition-colors ${
                    selectedEvent?.id === event.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-muted-foreground ring-1 ring-border/50 hover:bg-secondary"
                  }`}
                >
                  {event.title}
                </button>
              ))}
              {eventsList.length === 0 && !isLoading && (
                <p className="text-sm text-muted-foreground">No events to show registrations for.</p>
              )}
            </div>

            {isLoadingDetail ? (
              <div className="overflow-hidden rounded-xl bg-card shadow-sm ring-1 ring-border/50">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border/50 bg-secondary/50">
                    <th className={tableHeadClass}>Name</th><th className={tableHeadClass}>Email</th><th className={tableHeadClass}>Group</th><th className={tableHeadClass}>Registered</th>
                  </tr></thead>
                  <tbody>
                    {Array.from({ length: 3 }).map((_, i) => (
                      <tr key={i} className="border-b border-border/30">
                        <td className={tableCellClass}><Skeleton className="h-4 w-32" /></td>
                        <td className={tableCellClass}><Skeleton className="h-4 w-40" /></td>
                        <td className={tableCellClass}><Skeleton className="h-4 w-20" /></td>
                        <td className={tableCellClass}><Skeleton className="h-4 w-24" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : selectedEvent ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">{selectedEvent.title} — {selectedEvent.registrationCount} / {selectedEvent.maxParticipants} registered</p>
                <div className="overflow-hidden rounded-xl bg-card shadow-sm ring-1 ring-border/50">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-border/50 bg-secondary/50">
                      <th className={tableHeadClass}>Name</th><th className={tableHeadClass}>Email</th><th className={tableHeadClass}>Group</th><th className={tableHeadClass}>Registered At</th>
                    </tr></thead>
                    <tbody>
                      {selectedEvent.registrations.length === 0 ? (
                        <tr><td colSpan={4} className="px-4 py-16 text-center text-sm text-muted-foreground">No registrations yet.</td></tr>
                      ) : (
                        selectedEvent.registrations.map((reg: Registration) => (
                          <tr key={reg.id} className="border-b border-border/30 last:border-0">
                            <td className={`${tableCellClass} font-medium`}>{reg.studentName ?? "—"}</td>
                            <td className={`${tableCellClass} text-muted-foreground`}>{reg.studentEmail}</td>
                            <td className={tableCellClass}>{reg.group ?? "—"}</td>
                            <td className={`${tableCellClass} text-muted-foreground`}>{new Date(reg.registeredAt).toLocaleDateString()}</td>
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

      <Dialog open={createDialogOpen} onOpenChange={(open) => { setCreateDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Event</DialogTitle>
            <DialogDescription>Add a new university event. Students will be able to register.</DialogDescription>
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
              {imagePreview && <img src={imagePreview} alt="Preview" className="mt-2 max-h-48 rounded-xl object-cover" />}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" className="rounded-lg" onClick={() => setCreateDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
            <Button className="rounded-lg" onClick={handleCreate} disabled={isSubmitting}>{isSubmitting ? "Creating..." : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
