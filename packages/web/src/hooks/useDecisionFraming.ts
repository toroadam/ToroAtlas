"use client";

import { useCallback, useState } from "react";
import { useRuntimeConfig } from "@/app/providers";
import type { DecisionFramingSuggestion } from "@/types/decisions";

type DecisionFramingRequestPayload = Readonly<{
  topic: string;
  context?: string;
  productArea?: string;
  segment?: string;
  successMetric?: string;
  decisionId?: string;
}>;

type DecisionFramingErrorPayload = Readonly<{
  message?: string;
  details?: {
    fieldErrors?: Record<string, string>;
  };
}>;

type UseDecisionFramingResult = Readonly<{
  suggestion: DecisionFramingSuggestion | null;
  isLoading: boolean;
  error: string | null;
  fieldErrors: Record<string, string>;
  requestSuggestion: (payload: DecisionFramingRequestPayload) => Promise<DecisionFramingSuggestion>;
  clearSuggestion: () => void;
  clearError: () => void;
}>;

function normalizeApiBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

function buildApiUrl(baseUrl: string, path: string): string {
  return `${normalizeApiBaseUrl(baseUrl)}${path}`;
}

export function useDecisionFraming(): UseDecisionFramingResult {
  const { apiBaseUrl } = useRuntimeConfig();
  const [suggestion, setSuggestion] = useState<DecisionFramingSuggestion | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const requestSuggestion = useCallback(
    async (payload: DecisionFramingRequestPayload): Promise<DecisionFramingSuggestion> => {
      setIsLoading(true);
      setError(null);
      setFieldErrors({});

      try {
        const response = await fetch(buildApiUrl(apiBaseUrl, "/ai/decision-framing"), {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        const responsePayload = (await response.json().catch(() => null)) as unknown;
        const errorPayload = responsePayload as DecisionFramingErrorPayload | null;

        if (!response.ok) {
          setFieldErrors(errorPayload?.details?.fieldErrors ?? {});
          throw new Error(errorPayload?.message ?? "Unable to generate framing suggestion.");
        }

        const successPayload = responsePayload as
          | {
              data?: {
                suggestion?: DecisionFramingSuggestion;
              };
            }
          | null;
        const nextSuggestion = successPayload?.data?.suggestion;
        if (!nextSuggestion) {
          throw new Error("Framing endpoint returned no suggestion payload.");
        }

        setSuggestion(nextSuggestion);
        return nextSuggestion;
      } catch (framingError) {
        const message =
          framingError instanceof Error
            ? framingError.message
            : "Unable to generate framing suggestion.";
        setError(message);
        throw framingError;
      } finally {
        setIsLoading(false);
      }
    },
    [apiBaseUrl],
  );

  const clearSuggestion = useCallback(() => {
    setSuggestion(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
    setFieldErrors({});
  }, []);

  return {
    suggestion,
    isLoading,
    error,
    fieldErrors,
    requestSuggestion,
    clearSuggestion,
    clearError,
  };
}
