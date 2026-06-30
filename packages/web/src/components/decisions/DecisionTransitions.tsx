"use client";

import type { DecisionLifecycleStatus } from "@/types/decisions";
import { Button } from "@/components/ui/button";
import { DECISION_TRANSITIONS } from "@/hooks/useDecisions";

const STATUS_LABELS: Record<DecisionLifecycleStatus, string> = {
  framing: "Framing",
  research: "Research",
  alignment: "Alignment",
  approved: "Approved",
  implemented: "Implemented",
  superseded: "Superseded",
  archived: "Archived"
};

type DecisionTransitionsProps = Readonly<{
  currentStatus: DecisionLifecycleStatus;
  isSubmitting: boolean;
  error: string | null;
  onTransition: (targetStatus: DecisionLifecycleStatus) => Promise<void>;
}>;

export function DecisionTransitions({
  currentStatus,
  isSubmitting,
  error,
  onTransition
}: DecisionTransitionsProps): JSX.Element {
  const availableTransitions = DECISION_TRANSITIONS[currentStatus];

  return (
    <section className="rounded-lg border p-4">
      <h3 className="text-sm font-semibold">Lifecycle transitions</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Current status: {STATUS_LABELS[currentStatus]}
      </p>

      {availableTransitions.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No further lifecycle transitions available.
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {availableTransitions.map((status) => (
            <Button
              key={status}
              variant="outline"
              size="sm"
              disabled={isSubmitting}
              onClick={() => void onTransition(status)}
            >
              Move to {STATUS_LABELS[status]}
            </Button>
          ))}
        </div>
      )}

      {error ? <p className="mt-3 text-xs text-destructive">{error}</p> : null}
    </section>
  );
}
