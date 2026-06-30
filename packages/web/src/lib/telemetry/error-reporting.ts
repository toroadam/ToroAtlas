type ReportableError = unknown;

type ErrorContext = Readonly<{
  source: string;
  metadata?: Record<string, unknown>;
}>;

export function normalizeError(error: ReportableError): Error {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === "string") {
    return new Error(error);
  }

  return new Error("Unknown error");
}

export function reportError(error: ReportableError, context: ErrorContext): void {
  const normalizedError = normalizeError(error);
  const payload = {
    source: context.source,
    message: normalizedError.message,
    stack: normalizedError.stack,
    metadata: context.metadata ?? {}
  };

  if (process.env.NODE_ENV !== "production") {
    console.error("[telemetry] captured error", payload);
  }

  // Placeholder for future telemetry sinks (for example, Sentry or OpenTelemetry exporters).
}
