"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DecisionForm } from "@/components/decisions/DecisionForm";
import { Button } from "@/components/ui/button";

export default function NewDecisionPage(): JSX.Element {
  return (
    <section className="space-y-6">
      <Button asChild variant="ghost" className="px-0">
        <Link href="/decisions">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to decisions
        </Link>
      </Button>
      <DecisionForm mode="create" />
    </section>
  );
}
