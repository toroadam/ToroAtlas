"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/states/ErrorState";
import { reportError } from "@/lib/telemetry/error-reporting";

type GlobalErrorProps = Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>;

export default function GlobalError({
  error,
  reset
}: GlobalErrorProps): JSX.Element {
  useEffect(() => {
    reportError(error, {
      source: "app.error-boundary",
      metadata: {
        digest: error.digest
      }
    });
  }, [error]);

  return (
    <div className="container py-12">
      <ErrorState
        title="Application shell error"
        description="The app encountered an unexpected error. You can retry the current route."
        onRetry={reset}
      />
    </div>
  );
}
