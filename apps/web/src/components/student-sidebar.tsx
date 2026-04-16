import { Link, useMatchRoute } from "@tanstack/react-router";
import {
  GraduationCap,
  Home,
  LogOut,
  MessageSquare,
  Settings,
  StickyNote,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/auth";

const navItems = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/discussions", label: "Discussions", icon: MessageSquare },
  { to: "/notes-deadlines", label: "Notes | Deadlines", icon: StickyNote },
  { to: "/profile", label: "Profile", icon: User },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function StudentSidebar() {
  const { signOut, profile } = useAuth();
  const matchRoute = useMatchRoute();

  return (
    <aside className="flex h-svh w-60 flex-col border-r border-border/50 bg-card">
      <div className="flex h-14 items-center gap-2.5 px-5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-accent">
          <GraduationCap className="size-4 text-accent-foreground" />
        </div>
        <Link to="/home" className="text-base font-bold tracking-tight">
          UniCommunity
        </Link>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map(({ to, label, icon: Icon }) => {
          const isActive = matchRoute({ to, fuzzy: to !== "/home" });

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
          {profile?.fullName ?? "Student"}
        </div>
        <button
          type="button"
          onClick={() => signOut()}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <LogOut className="size-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
