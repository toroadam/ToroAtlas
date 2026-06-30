"use client";

import { useParams } from "next/navigation";
import { DecisionDetail } from "@/components/decisions/DecisionDetail";

export default function DecisionDetailPage(): JSX.Element {
  const params = useParams<{ decisionId: string }>();
  const decisionId = params.decisionId ?? "";
  return <DecisionDetail decisionId={decisionId} />;
}
