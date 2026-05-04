import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { DISCUSSION_CATEGORIES } from "./types";
import type { DiscussionCategory } from "./types";

type EditDiscussionDialogProps = {
  open: boolean;
  title: string;
  content: string;
  category: DiscussionCategory;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onTitleChange: (value: string) => void;
  onContentChange: (value: string) => void;
  onCategoryChange: (value: DiscussionCategory) => void;
  onSave: () => void;
};

export function EditDiscussionDialog({
  open,
  title,
  content,
  category,
  isSubmitting,
  onOpenChange,
  onTitleChange,
  onContentChange,
  onCategoryChange,
  onSave,
}: EditDiscussionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Discussion</DialogTitle>
          <DialogDescription>Update your discussion.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="discussion-title">Title</Label>
            <Input
              id="discussion-title"
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              className="rounded-lg bg-background"
            />
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <div className="flex flex-wrap gap-2">
              {DISCUSSION_CATEGORIES.map((item) => (
                <Button
                  key={item}
                  type="button"
                  onClick={() => onCategoryChange(item)}
                  variant={category === item ? "default" : "secondary"}
                  size="sm"
                  className={`rounded-lg text-sm ${
                    category === item
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {item}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="discussion-content">Content</Label>
            <Textarea
              id="discussion-content"
              value={content}
              onChange={(event) => onContentChange(event.target.value)}
              rows={5}
              className="rounded-lg bg-background"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            className="rounded-lg"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button className="rounded-lg" onClick={onSave} disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
