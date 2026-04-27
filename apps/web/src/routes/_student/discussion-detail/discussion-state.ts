import type { Comment, DiscussionCategory, DiscussionDetail } from "./types";

export type OptimisticAction =
  | { type: "react-discussion" }
  | {
      type: "react-comment";
      commentId: string;
      helpfulAuthorId?: string;
      authorHasHelpfulMarker?: boolean;
    }
  | { type: "delete-comment"; commentId: string };

// Reuse the same pure transforms for optimistic UI and committed server responses.
export function applyOptimisticDiscussionAction(
  current: DiscussionDetail | null,
  action: OptimisticAction,
) {
  if (!current) return current;

  switch (action.type) {
    case "react-discussion":
      return toggleDiscussionReaction(current);
    case "react-comment":
      const nextDiscussion = toggleCommentReaction(current, action.commentId);
      return {
        ...nextDiscussion,
        // Helpful markers belong to the author, so update all of their visible comments together.
        comments: nextDiscussion.comments.map((comment) =>
          action.helpfulAuthorId === comment.authorId &&
          typeof action.authorHasHelpfulMarker === "boolean"
            ? {
                ...comment,
                authorHasHelpfulMarker: action.authorHasHelpfulMarker,
              }
            : comment,
        ),
      };
    case "delete-comment":
      return removeComment(current, action.commentId);
  }
}

export function toggleDiscussionReaction(discussion: DiscussionDetail) {
  return {
    ...discussion,
    isReacted: !discussion.isReacted,
    reactionsCount:
      discussion.reactionsCount + (discussion.isReacted ? -1 : 1),
  };
}

export function toggleCommentReaction(
  discussion: DiscussionDetail,
  commentId: string,
  wasReacted?: boolean,
) {
  return {
    ...discussion,
    comments: discussion.comments.map((comment) => {
      if (comment.id !== commentId) return comment;

      const currentlyReacted = wasReacted ?? comment.isReacted;
      return {
        ...comment,
        isReacted: !currentlyReacted,
        reactionsCount: comment.reactionsCount + (currentlyReacted ? -1 : 1),
      };
    }),
  };
}

export function removeComment(discussion: DiscussionDetail, commentId: string) {
  return {
    ...discussion,
    comments: discussion.comments.filter((comment) => comment.id !== commentId),
  };
}

export function appendComment(
  discussion: DiscussionDetail,
  comment: Comment,
) {
  return {
    ...discussion,
    comments: [...discussion.comments, comment],
  };
}

export function updateDiscussionContent(
  discussion: DiscussionDetail,
  updates: {
    title: string;
    content: string;
    category: DiscussionCategory;
    updatedAt: string;
  },
) {
  return {
    ...discussion,
    ...updates,
  };
}

export function updateCommentContent(
  discussion: DiscussionDetail,
  commentId: string,
  updates: Pick<Comment, "content" | "updatedAt">,
) {
  return {
    ...discussion,
    comments: discussion.comments.map((comment) =>
      comment.id === commentId ? { ...comment, ...updates } : comment,
    ),
  };
}

export function applyHelpfulMarkerToAuthor(
  discussion: DiscussionDetail,
  authorId: string,
  authorHasHelpfulMarker: boolean,
) {
  return {
    ...discussion,
    comments: discussion.comments.map((comment) =>
      comment.authorId === authorId
        ? { ...comment, authorHasHelpfulMarker }
        : comment,
    ),
  };
}
