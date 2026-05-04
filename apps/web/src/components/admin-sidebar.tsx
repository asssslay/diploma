import { Link, useMatchRoute } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  Newspaper,
  CalendarDays,
  MessageSquare,
  LogOut,
  GraduationCap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/auth";

const navItems = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/students", label: "Students", icon: Users },
  { to: "/admin/news", label: "News", icon: Newspaper },
  { to: "/admin/events", label: "Events", icon: CalendarDays },
  { to: "/admin/discussions", label: "Discussions", icon: MessageSquare },
] as const;

export function AdminSidebar() {
  const { signOut, profile } = useAuth();
  const matchRoute = useMatchRoute();

  return (
    <aside className="flex h-svh w-60 flex-col border-r border-border/50 bg-card">
      <div className="flex h-14 items-center gap-2.5 px-5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary">
          <GraduationCap className="size-4 text-primary-foreground" />
        </div>
        <Link to="/admin" className="text-base font-bold tracking-tight">
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
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border/50 px-3 py-4">
        <div className="mb-3 px-3 text-xs font-medium text-muted-foreground">
          {profile?.fullName ?? "Administrator"}
        </div>
        <Button
          type="button"
          onClick={() => signOut()}
          variant="ghost"
          className="h-auto w-full cursor-pointer justify-start gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <LogOut className="size-4" />
          Sign Out
        </Button>
      </div>
    </aside>
  );
}
