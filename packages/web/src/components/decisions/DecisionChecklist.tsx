"use client";

import { CheckCircle2, CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DecisionChecklistEvaluation } from "@/types/decisions";

type DecisionChecklistProps = Readonly<{
  checklist: DecisionChecklistEvaluation;
  title?: string;
  className?: string;
}>;

function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

export function DecisionChecklist({
  checklist,
  title = "Checklist readiness",
  className
}: DecisionChecklistProps): JSX.Element {
  return (
    <section className={cn("rounded-lg border bg-card p-4", className)}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="text-xs text-muted-foreground">
          {formatPercent(checklist.completionRatio)} complete
        </span>
      </header>

      <div className="mt-3 h-2 w-full rounded-full bg-muted">
        <div
          className={cn(
            "h-2 rounded-full transition-all",
            checklist.isComplete ? "bg-emerald-500" : "bg-amber-500"
          )}
          style={{ width: formatPercent(checklist.completionRatio) }}
        />
      </div>

      <ul className="mt-4 space-y-2">
        {checklist.items.map((item) => (
          <li key={item.id} className="flex gap-2 text-sm">
            {item.passed ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            )}
            <div>
              <p className={cn("font-medium", item.passed ? "text-foreground" : "text-amber-700")}>
                {item.label}
              </p>
              {!item.passed ? (
                <p className="text-xs text-muted-foreground">{item.reason}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
