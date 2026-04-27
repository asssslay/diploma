import type { Deadline } from "./types";

export type Urgency = "overdue" | "today" | "tomorrow" | "this-week" | "later";

export function getUrgency(dueAt: string): Urgency {
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

export const URGENCY_LABELS: Record<Urgency, string> = {
  overdue: "Overdue",
  today: "Today",
  tomorrow: "Tomorrow",
  "this-week": "This week",
  later: "Later",
};

export const URGENCY_STYLES: Record<Urgency, string> = {
  overdue: "bg-destructive/10 text-destructive",
  today: "bg-amber-100 text-amber-700",
  tomorrow: "bg-accent text-accent-foreground",
  "this-week": "bg-secondary text-secondary-foreground",
  later: "bg-secondary text-muted-foreground",
};

export function formatDueAt(dueAt: string): string {
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

  return `${datePart} - ${timePart}`;
}

export function toDatetimeLocal(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function getReminderSummary(deadline: Deadline) {
  return [
    deadline.reminder24hEmailId && "24h",
    deadline.reminder1hEmailId && "1h",
  ]
    .filter(Boolean)
    .join(" + ");
}
