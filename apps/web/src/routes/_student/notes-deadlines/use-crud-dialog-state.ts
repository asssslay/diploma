import { useState } from "react";

import type { DialogMode } from "./types";

export function useCrudDialogState<TItem>() {
  const [activeItem, setActiveItem] = useState<TItem | null>(null);
  const [mode, setMode] = useState<DialogMode>("view");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const dialogOpen = activeItem !== null || mode === "create";

  function closeDialog() {
    setActiveItem(null);
    setMode("view");
  }

  function openView(item: TItem) {
    setActiveItem(item);
    setMode("view");
  }

  function openCreate() {
    setActiveItem(null);
    setMode("create");
  }

  function startEdit(item: TItem) {
    setActiveItem(item);
    setMode("edit");
  }

  function cancelEdit() {
    if (activeItem) {
      setMode("view");
      return;
    }

    closeDialog();
  }

  function requestDelete(id: string) {
    setPendingDeleteId(id);
  }

  return {
    activeItem,
    setActiveItem,
    mode,
    setMode,
    pendingDeleteId,
    setPendingDeleteId,
    isSubmitting,
    setIsSubmitting,
    isDeleting,
    setIsDeleting,
    dialogOpen,
    closeDialog,
    openView,
    openCreate,
    startEdit,
    cancelEdit,
    requestDelete,
  };
}
