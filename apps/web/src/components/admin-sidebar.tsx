import { Link, useMatchRoute } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  Newspaper,
  CalendarDays,
  MessageSquare,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/auth";

const navItems = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/students", label: "Student List", icon: Users },
  { to: "/admin/news", label: "News Management", icon: Newspaper },
  { to: "/admin/events", label: "Event Management", icon: CalendarDays },
  {
    to: "/admin/discussions",
    label: "Discussion Moderation",
    icon: MessageSquare,
  },
] as const;

export function AdminSidebar() {
  const { signOut, profile } = useAuth();
  const matchRoute = useMatchRoute();

  return (
    <aside className="flex h-svh w-64 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center border-b px-5">
        <Link to="/admin" className="text-lg font-semibold tracking-tight">
          UniCommunity
        </Link>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map(({ to, label, icon: Icon }) => {
          const isActive =
            to === "/admin"
              ? matchRoute({ to, fuzzy: false })
              : matchRoute({ to, fuzzy: true });

          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t px-3 py-4">
        <div className="mb-3 px-3 text-xs text-sidebar-foreground/50">
          {profile?.fullName ?? "Administrator"}
        </div>
        <button
          type="button"
          onClick={() => signOut()}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
        >
          <LogOut className="size-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
