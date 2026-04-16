import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Settings } from "lucide-react";
import { toast } from "sonner";
import type { InferResponseType } from "hono/client";
import { hc } from "hono/client";

import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { getApiClient } from "@/lib/api";
import type { AppType } from "server";

type Client = ReturnType<typeof hc<AppType>>;
type SettingsEndpoint = Client["api"]["settings"]["$get"];
type SettingsResponse = Extract<
  InferResponseType<SettingsEndpoint>,
  { success: true }
>;
type UserSettings = SettingsResponse["data"];

export const Route = createFileRoute("/_student/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [savingField, setSavingField] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const api = await getApiClient();
      const res = await api.api.settings.$get();
      if (!res.ok) {
        toast.error("Failed to load settings");
        return;
      }
      const json = (await res.json()) as SettingsResponse;
      setSettings(json.data);
    } catch {
      toast.error("Failed to load settings");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  async function handleToggle(field: keyof UserSettings, value: boolean) {
    if (!settings || savingField) return;
    setSavingField(field);
    try {
      const api = await getApiClient();
      const res = await api.api.settings.$patch({
        json: { [field]: value },
      });
      if (!res.ok) {
        toast.error("Failed to update setting");
        return;
      }
      const json = (await res.json()) as SettingsResponse;
      setSettings(json.data);
      toast.success("Setting updated");
    } catch {
      toast.error("Failed to update setting");
    } finally {
      setSavingField(null);
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
        <Skeleton className="h-8 w-32" />
        <div className="rounded-xl bg-card p-6 shadow-sm ring-1 ring-border/50">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="mt-1 h-4 w-64" />
          <div className="mt-4 space-y-4">
            <Skeleton className="h-[72px] rounded-lg" />
            <Skeleton className="h-[72px] rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="flex flex-col items-center gap-3 py-20">
          <div className="flex size-14 items-center justify-center rounded-full bg-secondary">
            <Settings className="size-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            Failed to load settings.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>

      <div className="rounded-xl bg-card p-6 shadow-sm ring-1 ring-border/50">
        <h2 className="text-sm font-semibold">Notifications</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Choose which email notifications you receive.
        </p>

        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between rounded-lg bg-background p-4">
            <div className="space-y-0.5">
              <Label
                htmlFor="notify-deadlines"
                className="text-sm font-medium"
              >
                Deadline reminders
              </Label>
              <p className="text-xs text-muted-foreground">
                Get email reminders 24 hours and 1 hour before your deadlines.
              </p>
            </div>
            <Switch
              id="notify-deadlines"
              checked={settings.notifyDeadlineReminders}
              onCheckedChange={(checked) =>
                handleToggle("notifyDeadlineReminders", checked)
              }
              disabled={savingField !== null}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg bg-background p-4">
            <div className="space-y-0.5">
              <Label htmlFor="notify-events" className="text-sm font-medium">
                Event reminders
              </Label>
              <p className="text-xs text-muted-foreground">
                Get email reminders 24 hours and 1 hour before events you
                registered for.
              </p>
            </div>
            <Switch
              id="notify-events"
              checked={settings.notifyEventReminders}
              onCheckedChange={(checked) =>
                handleToggle("notifyEventReminders", checked)
              }
              disabled={savingField !== null}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
