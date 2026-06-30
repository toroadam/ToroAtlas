"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  Decision,
  DecisionLifecycleStatus,
  DecisionListFilters
} from "@/types/decisions";

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

type DecisionListProps = Readonly<{
  decisions: Decision[];
  filters: DecisionListFilters;
  ownerOptions: string[];
  isRefreshing?: boolean;
  onFilterChange: (updates: Partial<DecisionListFilters>) => void;
}>;

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));
}

function getFilterValue(value: string | undefined): string {
  return value ?? "";
}

function getLifecycleFilterValue(
  value: DecisionListFilters["lifecycleStatus"]
): DecisionLifecycleStatus | "all" {
  return value ?? "all";
}

export function DecisionList({
  decisions,
  filters,
  ownerOptions,
  isRefreshing = false,
  onFilterChange
}: DecisionListProps): JSX.Element {
  return (
    <section className="space-y-4">
      <div className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-4">
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Search
          </label>
          <input
            value={getFilterValue(filters.query)}
            onChange={(event) => onFilterChange({ query: event.target.value })}
            placeholder="Search title, context, segment..."
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Lifecycle
          </label>
          <select
            value={getLifecycleFilterValue(filters.lifecycleStatus)}
            onChange={(event) =>
              onFilterChange({
                lifecycleStatus: event.target.value as DecisionLifecycleStatus | "all"
              })
            }
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          >
            <option value="all">All statuses</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Owner
          </label>
          <select
            value={getFilterValue(filters.ownerId)}
            onChange={(event) => onFilterChange({ ownerId: event.target.value })}
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          >
            <option value="">All owners</option>
            {ownerOptions.map((ownerId) => (
              <option key={ownerId} value={ownerId}>
                {ownerId}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end justify-end">
          <Button
            variant="ghost"
            onClick={() =>
              onFilterChange({
                lifecycleStatus: "all",
                ownerId: "",
                query: ""
              })
            }
          >
            Reset filters
          </Button>
        </div>
      </div>

      {decisions.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm font-medium">No decisions matched the selected filters.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Adjust filters or create a new decision.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <ul className="divide-y">
            {decisions.map((decision) => (
              <li key={decision.id} className="p-4">
                <article className="space-y-3">
                  <header className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <Link
                        href={`/decisions/${decision.id}`}
                        className="text-base font-semibold hover:underline"
                      >
                        {decision.title}
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        {decision.framing.decisionQuestion}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-1 text-xs font-semibold",
                          STATUS_BADGE_CLASSES[decision.lifecycleStatus]
                        )}
                      >
                        {STATUS_LABELS[decision.lifecycleStatus]}
                      </span>
                    </div>
                  </header>

                  <dl className="grid gap-3 text-sm text-muted-foreground md:grid-cols-4">
                    <div>
                      <dt className="font-medium text-foreground">Owner</dt>
                      <dd>{decision.framing.ownerId}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-foreground">Priority</dt>
                      <dd className="capitalize">{decision.framing.priority}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-foreground">Segment</dt>
                      <dd>{decision.framing.segment}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-foreground">Updated</dt>
                      <dd>{formatDate(decision.updatedAt)}</dd>
                    </div>
                  </dl>
                </article>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isRefreshing ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Refreshing list...
        </p>
      ) : null}
    </section>
  );
}
