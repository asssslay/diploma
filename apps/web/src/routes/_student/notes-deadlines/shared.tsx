import type { ReactNode } from "react";
import type { ZodIssue } from "zod";
import { MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

export function mapZodIssuesToFieldErrors<TField extends string>(
  issues: ZodIssue[],
): Partial<Record<TField, string>> {
  const fieldErrors: Partial<Record<TField, string>> = {};

  for (const issue of issues) {
    const field = issue.path[0];
    if (typeof field !== "string") continue;
    if (!fieldErrors[field as TField]) {
      fieldErrors[field as TField] = issue.message;
    }
  }

  return fieldErrors;
}

type ListToolbarProps = {
  searchOpen: boolean;
  searchValue: string;
  searchPlaceholder: string;
  searchButtonLabel: string;
  sortButtonLabel: string;
  sortButtonText: string;
  sortIcon: ReactNode;
  createButtonLabel: string;
  onSearchChange: (value: string) => void;
  onSearchToggle: () => void;
  onSortToggle: () => void;
  onCreate: () => void;
};

export function ListToolbar({
  searchOpen,
  searchValue,
  searchPlaceholder,
  searchButtonLabel,
  sortButtonLabel,
  sortButtonText,
  sortIcon,
  createButtonLabel,
  onSearchChange,
  onSearchToggle,
  onSortToggle,
  onCreate,
}: ListToolbarProps) {
  return (
    <div className="flex items-center gap-2">
      {searchOpen && (
        <Input
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          className="h-9 flex-1 rounded-lg bg-card shadow-sm ring-1 ring-border/50"
          autoFocus
        />
      )}
      <button
        type="button"
        onClick={onSearchToggle}
        aria-label={searchButtonLabel}
        className="flex size-9 items-center justify-center rounded-lg bg-card shadow-sm ring-1 ring-border/50 transition-colors hover:bg-secondary"
      >
        <Search className="size-4 text-muted-foreground" />
      </button>
      <button
        type="button"
        onClick={onSortToggle}
        aria-label={sortButtonLabel}
        className="flex h-9 items-center gap-1.5 rounded-lg bg-card px-3 text-sm font-medium shadow-sm ring-1 ring-border/50 transition-colors hover:bg-secondary"
      >
        {sortIcon}
        {sortButtonText}
      </button>
      <div className="flex-1" />
      <Button className="rounded-lg" onClick={onCreate}>
        <Plus className="mr-2 size-4" />
        {createButtonLabel}
      </Button>
    </div>
  );
}

type ItemActionsMenuProps = {
  itemLabel: string;
  onEdit: () => void;
  onDelete: () => void;
};

export function ItemActionsMenu({
  itemLabel,
  onEdit,
  onDelete,
}: ItemActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        type="button"
        aria-label={`${itemLabel} actions`}
        className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        onClick={(event) => event.stopPropagation()}
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={(event) => {
            event.stopPropagation();
            onEdit();
          }}
        >
          <Pencil className="size-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className="size-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
