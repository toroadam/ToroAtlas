"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { DecisionForm } from "@/components/decisions/DecisionForm";
import { ErrorState } from "@/components/states/ErrorState";
import { LoadingState } from "@/components/states/LoadingState";
import { Button } from "@/components/ui/button";
import { useDecisionDetail } from "@/hooks/useDecisions";

export default function EditDecisionPage(): JSX.Element {
  const params = useParams<{ decisionId: string }>();
  const router = useRouter();
  const decisionId = params.decisionId ?? "";
  const { decision, isLoading, error, reload } = useDecisionDetail(decisionId);

  if (isLoading) {
    return (
      <LoadingState
        title="Loading decision"
        description="Preparing editable framing fields..."
      />
    );
  }

  if (error || !decision) {
    return (
      <ErrorState
        title="Unable to load decision"
        description={error ?? "Decision was not found in the current tenant scope."}
        onRetry={reload}
      />
    );
  }

  return (
    <section className="space-y-6">
      <Button asChild variant="ghost" className="px-0">
        <Link href={`/decisions/${decisionId}`}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to detail
        </Link>
      </Button>

      <DecisionForm
        mode="edit"
        decisionId={decisionId}
        initialDecision={decision}
        onSaved={(savedDecision) => {
          router.push(`/decisions/${savedDecision.id}`);
          router.refresh();
        }}
      />
    </section>
  );
}
