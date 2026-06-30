"use client";

import { useState } from "react";
import { MessageSquareText } from "lucide-react";
import { LoadingState } from "@/components/states/LoadingState";
import { ErrorState } from "@/components/states/ErrorState";
import { EmptyState } from "@/components/states/EmptyState";
import { Button } from "@/components/ui/button";
import type { DecisionComment } from "@/types/decisions";

type DecisionCommentsProps = Readonly<{
  comments: DecisionComment[];
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
  onRetry: () => void;
  onSubmitComment: (body: string) => Promise<void>;
}>;

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

export function DecisionComments({
  comments,
  isLoading,
  isSubmitting,
  error,
  onRetry,
  onSubmitComment
}: DecisionCommentsProps): JSX.Element {
  const [commentBody, setCommentBody] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const submitComment = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setSubmitError(null);
    const value = commentBody.trim();
    if (!value) {
      setSubmitError("Comment body is required.");
      return;
    }

    try {
      await onSubmitComment(value);
      setCommentBody("");
    } catch (submitCommentError) {
      setSubmitError(
        submitCommentError instanceof Error
          ? submitCommentError.message
          : "Failed to submit comment."
      );
    }
  };

  return (
    <section className="space-y-4 rounded-lg border p-4">
      <header>
        <h3 className="text-sm font-semibold">Comments</h3>
        <p className="text-xs text-muted-foreground">
          Capture discussion and rationale updates on this decision.
        </p>
      </header>

      <form className="space-y-2" onSubmit={(event) => void submitComment(event)}>
        <textarea
          value={commentBody}
          onChange={(event) => setCommentBody(event.target.value)}
          rows={3}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          placeholder="Add a comment..."
        />
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Comments are posted to the decision thread in chronological order.
          </p>
          <Button type="submit" size="sm" disabled={isSubmitting}>
            {isSubmitting ? "Posting..." : "Post comment"}
          </Button>
        </div>
      </form>

      {submitError ? <p className="text-xs text-destructive">{submitError}</p> : null}
      {error ? (
        <ErrorState description={error} title="Unable to load comments" onRetry={onRetry} />
      ) : null}
      {isLoading ? (
        <LoadingState title="Loading comments" description="Retrieving decision thread..." />
      ) : null}

      {!isLoading && !error && comments.length === 0 ? (
        <EmptyState
          title="No comments yet"
          description="Start the discussion by posting the first decision comment."
          icon={<MessageSquareText className="h-5 w-5" />}
          className="min-h-40 py-8"
        />
      ) : null}

      {!isLoading && !error && comments.length > 0 ? (
        <ul className="space-y-3">
          {comments.map((comment) => (
            <li key={comment.id} className="rounded-md border p-3">
              <p className="text-sm">{comment.body}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {comment.createdByUserId} · {formatDate(comment.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
