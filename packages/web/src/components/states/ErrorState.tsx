"use client";

import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

type ErrorStateProps = Readonly<{
  title?: string;
  description: string;
  action?: ReactNode;
  onRetry?: () => void;
}>;

export function ErrorState({
  title = "Something went wrong",
  description,
  action,
  onRetry
}: ErrorStateProps): JSX.Element {
  return (
    <section className="flex min-h-60 w-full flex-col items-center justify-center gap-4 rounded-lg border border-destructive/20 bg-destructive/5 p-8 text-center">
      <AlertTriangle className="h-6 w-6 text-destructive" />
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="max-w-xl text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {onRetry ? (
          <Button onClick={onRetry} variant="destructive">
            Try again
          </Button>
        ) : null}
        {action}
      </div>
    </section>
  );
}
