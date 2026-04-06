import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";

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
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { InferResponseType } from "hono/client";
import { getApiClient } from "@/lib/api";
import type { AppType } from "server";
import { hc } from "hono/client";

type Client = ReturnType<typeof hc<AppType>>;
type ListEndpoint = Client["api"]["admin"]["applications"]["$get"];
type SuccessResponse = Extract<
  InferResponseType<ListEndpoint>,
  { success: true }
>;
type Application = SuccessResponse["data"][number];

export const Route = createFileRoute("/admin/_authenticated/students")({
  component: StudentsPage,
});

type StatusFilter = "pending" | "approved" | "rejected" | undefined;

const STATUS_BADGE_VARIANT = {
  pending: "outline",
  approved: "default",
  rejected: "destructive",
} as const;

function StudentsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalPages = Math.ceil(total / pageSize);

  const fetchApplications = useCallback(async () => {
    setIsLoading(true);
    try {
      const api = await getApiClient();
      const res = await api.api.admin.applications.$get({
        query: {
          ...(statusFilter ? { status: statusFilter } : {}),
          page: String(page),
          pageSize: String(pageSize),
        },
      });

      if (!res.ok) {
        toast.error("Failed to load applications");
        return;
      }

      const json = (await res.json()) as SuccessResponse;
      setApplications(json.data);
      setTotal(json.total);
    } catch {
      toast.error("Failed to load applications");
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, page, pageSize]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  async function handleApprove(id: string) {
    try {
      const api = await getApiClient();
      const res = await api.api.admin.applications[":id"].approve.$patch({
        param: { id },
      });

      if (!res.ok) {
        toast.error("Failed to approve");
        return;
      }

      toast.success("Application approved");
      fetchApplications();
    } catch {
      toast.error("Failed to approve application");
    }
  }

  function openRejectDialog(id: string) {
    setRejectTargetId(id);
    setRejectReason("");
    setRejectDialogOpen(true);
  }

  async function handleReject() {
    if (!rejectTargetId || !rejectReason.trim()) return;

    setIsSubmitting(true);
    try {
      const api = await getApiClient();
      const res = await api.api.admin.applications[":id"].reject.$patch({
        param: { id: rejectTargetId },
        json: { reason: rejectReason.trim() },
      });

      if (!res.ok) {
        toast.error("Failed to reject");
        return;
      }

      toast.success("Application rejected");
      setRejectDialogOpen(false);
      fetchApplications();
    } catch {
      toast.error("Failed to reject application");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleFilterChange(value: string) {
    setStatusFilter(value === "all" ? undefined : (value as StatusFilter));
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Student Applications
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review and manage student registration requests.
        </p>
      </div>

      <Tabs defaultValue="all" onValueChange={handleFilterChange}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="overflow-hidden rounded-xl bg-card shadow-sm ring-1 ring-border/50">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 bg-secondary/50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Email</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Group</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Date</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border/30">
                  <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-40" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-5 w-16" /></td>
                  <td className="px-4 py-3"><Skeleton className="ml-auto h-8 w-20" /></td>
                </tr>
              ))
            ) : applications.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center text-sm text-muted-foreground">
                  No applications found.
                </td>
              </tr>
            ) : (
              applications.map((app) => (
                <tr key={app.id} className="border-b border-border/30 last:border-0">
                  <td className="px-4 py-3 font-medium">
                    {app.fullName ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {app.email}
                  </td>
                  <td className="px-4 py-3">{app.group ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(app.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_BADGE_VARIANT[app.status]} className="rounded-lg">
                      {app.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {app.status === "pending" && (
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleApprove(app.id)}
                          title="Approve"
                          className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                        >
                          <Check className="size-3.5" />
                        </button>
                        <button
                          onClick={() => openRejectDialog(app.id)}
                          title="Reject"
                          className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!isLoading && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="rounded-lg" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" className="rounded-lg" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Application</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this application. The student will
              be able to see this reason.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Enter rejection reason..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
            className="rounded-lg bg-background"
          />
          <DialogFooter>
            <Button variant="outline" className="rounded-lg" onClick={() => setRejectDialogOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button variant="destructive" className="rounded-lg" onClick={handleReject} disabled={!rejectReason.trim() || isSubmitting}>
              {isSubmitting ? "Rejecting..." : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
