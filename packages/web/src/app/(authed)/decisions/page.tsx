"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FileText, PlusCircle } from "lucide-react";
import { DecisionList } from "@/components/decisions/DecisionList";
import { EmptyState } from "@/components/states/EmptyState";
import { ErrorState } from "@/components/states/ErrorState";
import { LoadingState } from "@/components/states/LoadingState";
import { Button } from "@/components/ui/button";
import { useDecisions } from "@/hooks/useDecisions";
import type { DecisionListFilters } from "@/types/decisions";

const DEFAULT_FILTERS: DecisionListFilters = {
  lifecycleStatus: "all",
  ownerId: "",
  query: ""
};

export default function DecisionsPage(): JSX.Element {
  const [filters, setFilters] = useState<DecisionListFilters>(DEFAULT_FILTERS);
  const { decisions, isLoading, isRefreshing, error, reload } = useDecisions(filters);

  const ownerOptions = useMemo(() => {
    const owners = new Set(
      decisions
        .map((decision) => decision.framing.ownerId)
        .filter((ownerId) => ownerId.trim().length > 0)
    );
    return [...owners].sort((left, right) => left.localeCompare(right));
  }, [decisions]);

  if (isLoading) {
    return (
      <LoadingState
        title="Loading decisions"
        description="Retrieving lifecycle and ownership metadata..."
      />
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Unable to load decisions"
        description={error}
        onRetry={reload}
      />
    );
  }

  const isDefaultView =
    (filters.lifecycleStatus ?? "all") === "all" &&
    (filters.ownerId ?? "").trim().length === 0 &&
    (filters.query ?? "").trim().length === 0;

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Decisions</h1>
          <p className="text-sm text-muted-foreground">
            Browse decision records, monitor lifecycle status, and filter by owner context.
          </p>
        </div>
        <Button asChild>
          <Link href="/decisions/new">
            <PlusCircle className="mr-2 h-4 w-4" />
            New decision
          </Link>
        </Button>
      </header>

      {decisions.length === 0 && isDefaultView ? (
        <EmptyState
          title="No decisions captured yet"
          description="Start by creating a decision record with framing details and checklist context."
          icon={<FileText className="h-6 w-6" />}
          action={
            <Button asChild>
              <Link href="/decisions/new">Create decision</Link>
            </Button>
          }
        />
      ) : (
        <DecisionList
          decisions={decisions}
          filters={filters}
          ownerOptions={ownerOptions}
          isRefreshing={isRefreshing}
          onFilterChange={(updates) =>
            setFilters((previous) => ({
              ...previous,
              ...updates
            }))
          }
        />
      )}
    </section>
  );
}
