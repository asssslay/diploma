import type { LucideIcon } from "lucide-react";
import {
  CalendarDays,
  GraduationCap,
  Mail,
  Shield,
  User,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

import { STATUS_BADGE, type Profile } from "./types";

type InfoItem =
  | {
      label: string;
      icon: LucideIcon;
      value: string;
      isMonospace?: boolean;
    }
  | {
      label: string;
      icon: LucideIcon;
      badge: { variant: "outline" | "default" | "destructive"; label: string };
    };

export function ProfileInfoCard({ profile }: { profile: Profile }) {
  const statusBadge = STATUS_BADGE[profile.status];
  const infoItems: InfoItem[] = [
    {
      label: "Full Name",
      icon: User,
      value: profile.fullName ?? "-",
    },
    {
      label: "Email",
      icon: Mail,
      value: profile.email,
    },
    {
      label: "Student ID",
      icon: Shield,
      value: profile.id.slice(0, 8).toUpperCase(),
      isMonospace: true,
    },
    {
      label: "Faculty",
      icon: GraduationCap,
      value: profile.faculty ?? "-",
    },
    {
      label: "Group",
      icon: Users,
      value: profile.group ?? "-",
    },
    {
      label: "Joined",
      icon: CalendarDays,
      value: formatDate(profile.createdAt),
    },
    {
      label: "Account Status",
      icon: Shield,
      badge: statusBadge,
    },
  ];

  return (
    <div className="rounded-xl bg-card p-6 shadow-sm ring-1 ring-border/50">
      <h2 className="text-sm font-semibold">Profile Information</h2>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {infoItems.map((item) => {
          const Icon = item.icon;

          return (
            <div
              key={item.label}
              className="flex items-center gap-3 rounded-lg bg-background p-4"
            >
              <div className="flex size-10 items-center justify-center rounded-full bg-secondary">
                <Icon className="size-4 text-foreground" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">{item.label}</p>
                {"badge" in item ? (
                  <Badge
                    variant={item.badge.variant}
                    className="mt-0.5 rounded-lg"
                  >
                    {item.badge.label}
                  </Badge>
                ) : (
                  <p
                    className={`text-sm font-medium ${
                      item.isMonospace ? "font-mono" : ""
                    }`}
                  >
                    {item.value}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
