"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Clock3 } from "lucide-react";
import { DecisionChecklist } from "@/components/decisions/DecisionChecklist";
import { DecisionComments } from "@/components/decisions/DecisionComments";
import { DecisionTransitions } from "@/components/decisions/DecisionTransitions";
import { ErrorState } from "@/components/states/ErrorState";
import { LoadingState } from "@/components/states/LoadingState";
import { Button } from "@/components/ui/button";
import { useDecisionComments, useDecisionDetail } from "@/hooks/useDecisions";
import { DecisionMutationError, useDecisionMutations } from "@/hooks/useDecisionMutations";
import { cn } from "@/lib/utils";
import type { DecisionLifecycleStatus } from "@/types/decisions";

type DecisionDetailProps = Readonly<{
  decisionId: string;
}>;

type TimelineEvent = Readonly<{
  id: string;
  title: string;
  subtitle: string;
  timestamp: string;
}>;

const STATUS_LABELS: Record<DecisionLifecycleStatus, string> = {
  framing: "Framing",
  research: "Research",
  alignment: "Alignment",
  approved: "Approved",
  implemented: "Implemented",
  superseded: "Superseded",
  archived: "Archived"
};

const STATUS_BADGE_CLASSES: Record<DecisionLifecycleStatus, string> = {
  framing: "bg-slate-100 text-slate-700",
  research: "bg-indigo-100 text-indigo-700",
  alignment: "bg-purple-100 text-purple-700",
  approved: "bg-green-100 text-green-700",
  implemented: "bg-emerald-100 text-emerald-700",
  superseded: "bg-amber-100 text-amber-800",
  archived: "bg-zinc-200 text-zinc-700"
};

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function createTimelineEvents(input: {
  decisionId: string;
  createdAt: string;
  createdByUserId: string;
  updatedAt: string;
  updatedByUserId: string;
  transitionedAt: string | null;
  lifecycleStatus: DecisionLifecycleStatus;
  comments: Array<{ id: string; body: string; createdByUserId: string; createdAt: string }>;
}): TimelineEvent[] {
  const events: TimelineEvent[] = [
    {
      id: `${input.decisionId}-created`,
      title: "Decision created",
      subtitle: `Created by ${input.createdByUserId}`,
      timestamp: input.createdAt
    }
  ];

  if (input.updatedAt !== input.createdAt) {
    events.push({
      id: `${input.decisionId}-updated`,
      title: "Decision updated",
      subtitle: `Updated by ${input.updatedByUserId}`,
      timestamp: input.updatedAt
    });
  }

  if (input.transitionedAt) {
    events.push({
      id: `${input.decisionId}-transitioned`,
      title: `Transitioned to ${STATUS_LABELS[input.lifecycleStatus]}`,
      subtitle: `Lifecycle transition recorded by ${input.updatedByUserId}`,
      timestamp: input.transitionedAt
    });
  }

  input.comments.forEach((comment) => {
    events.push({
      id: `comment-${comment.id}`,
      title: "Comment added",
      subtitle: `${comment.createdByUserId}: ${comment.body}`,
      timestamp: comment.createdAt
    });
  });

  return events.sort((left, right) => {
    const leftTime = new Date(left.timestamp).getTime();
    const rightTime = new Date(right.timestamp).getTime();
    return rightTime - leftTime;
  });
}

export function DecisionDetail({ decisionId }: DecisionDetailProps): JSX.Element {
  const {
    decision,
    checklist,
    isLoading: isLoadingDetail,
    isRefreshing: isRefreshingDetail,
    error: detailError,
    reload: reloadDetail
  } = useDecisionDetail(decisionId);

  const {
    comments,
    isLoading: isLoadingComments,
    error: commentsError,
    reload: reloadComments
  } = useDecisionComments(decisionId);

  const { transitionDecision, createComment, isSubmitting } = useDecisionMutations();
  const [transitionError, setTransitionError] = useState<string | null>(null);

  const timelineEvents = useMemo(() => {
    if (!decision) {
      return [];
    }
    return createTimelineEvents({
      decisionId: decision.id,
      createdAt: decision.createdAt,
      createdByUserId: decision.createdByUserId,
      updatedAt: decision.updatedAt,
      updatedByUserId: decision.updatedByUserId,
      transitionedAt: decision.transitionedAt,
      lifecycleStatus: decision.lifecycleStatus,
      comments
    });
  }, [comments, decision]);

  const onTransition = async (targetStatus: DecisionLifecycleStatus): Promise<void> => {
    setTransitionError(null);
    try {
      await transitionDecision(decisionId, targetStatus);
      reloadDetail();
    } catch (transitionFailure) {
      if (transitionFailure instanceof DecisionMutationError) {
        if (transitionFailure.failedCriteria.length > 0) {
          setTransitionError(
            transitionFailure.failedCriteria
              .map((criteria) => `${criteria.id}: ${criteria.reason}`)
              .join(" ")
          );
          return;
        }
      }
      setTransitionError(
        transitionFailure instanceof Error
          ? transitionFailure.message
          : "Failed to transition lifecycle status."
      );
    }
  };

  const onSubmitComment = async (body: string): Promise<void> => {
    await createComment(decisionId, body);
    reloadComments();
    reloadDetail();
  };

  if (isLoadingDetail) {
    return (
      <LoadingState
        title="Loading decision detail"
        description="Retrieving framing, checklist, and lifecycle context..."
      />
    );
  }

  if (detailError || !decision) {
    return (
      <ErrorState
        title="Unable to load decision detail"
        description={detailError ?? "Decision not found in the current tenant scope."}
        onRetry={reloadDetail}
      />
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" className="px-0">
          <Link href="/decisions">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to decisions
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href={`/decisions/${decision.id}/edit`}>Edit decision</Link>
        </Button>
      </div>

      <header className="space-y-3 rounded-lg border p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">{decision.title}</h1>
            <p className="text-sm text-muted-foreground">
              {decision.framing.decisionQuestion}
            </p>
          </div>
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-semibold",
              STATUS_BADGE_CLASSES[decision.lifecycleStatus]
            )}
          >
            {STATUS_LABELS[decision.lifecycleStatus]}
          </span>
        </div>

        <dl className="grid gap-4 text-sm md:grid-cols-3">
          <div>
            <dt className="font-medium text-foreground">Owner</dt>
            <dd className="text-muted-foreground">{decision.framing.ownerId}</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Priority</dt>
            <dd className="text-muted-foreground capitalize">{decision.framing.priority}</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Updated</dt>
            <dd className="text-muted-foreground">{formatDateTime(decision.updatedAt)}</dd>
          </div>
        </dl>
      </header>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <section className="space-y-4 rounded-lg border p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Framing
            </h2>
            <div className="space-y-4">
              <article>
                <h3 className="text-sm font-semibold">Context</h3>
                <p className="text-sm text-muted-foreground">{decision.framing.context}</p>
              </article>
              <article>
                <h3 className="text-sm font-semibold">Problem statement</h3>
                <p className="text-sm text-muted-foreground">
                  {decision.framing.problemStatement}
                </p>
              </article>
              <article>
                <h3 className="text-sm font-semibold">Decision statement</h3>
                <p className="text-sm text-muted-foreground">
                  {decision.framing.decisionStatement}
                </p>
              </article>
              <article>
                <h3 className="text-sm font-semibold">Rationale</h3>
                <p className="text-sm text-muted-foreground">{decision.framing.rationale}</p>
              </article>
              <article>
                <h3 className="text-sm font-semibold">Success metric</h3>
                <p className="text-sm text-muted-foreground">{decision.framing.successMetric}</p>
              </article>
              <article>
                <h3 className="text-sm font-semibold">Options considered</h3>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {decision.framing.optionsConsidered.map((option) => (
                    <li key={option}>{option}</li>
                  ))}
                </ul>
              </article>
            </div>
          </section>

          <DecisionComments
            comments={comments}
            isLoading={isLoadingComments}
            isSubmitting={isSubmitting}
            error={commentsError}
            onRetry={reloadComments}
            onSubmitComment={onSubmitComment}
          />
        </div>

        <aside className="space-y-4">
          {checklist ? <DecisionChecklist checklist={checklist} title="Checklist status" /> : null}
          <DecisionTransitions
            currentStatus={decision.lifecycleStatus}
            isSubmitting={isSubmitting}
            error={transitionError}
            onTransition={onTransition}
          />

          <section className="rounded-lg border p-4">
            <header className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Timeline</h3>
            </header>
            <ul className="mt-3 space-y-3">
              {timelineEvents.map((event) => (
                <li key={event.id} className="rounded-md border p-3">
                  <p className="text-sm font-medium">{event.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{event.subtitle}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {formatDateTime(event.timestamp)}
                  </p>
                </li>
              ))}
            </ul>
            {timelineEvents.length === 0 ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Timeline entries will appear after activity is recorded.
              </p>
            ) : null}
          </section>
        </aside>
      </div>

      {isRefreshingDetail ? (
        <p className="text-xs text-muted-foreground">Refreshing decision state...</p>
      ) : null}
    </section>
  );
}
