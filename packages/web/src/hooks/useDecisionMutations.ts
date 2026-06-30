"use client";

import { useCallback, useState } from "react";
import { useRuntimeConfig } from "@/app/providers";
import type {
  Decision,
  DecisionChecklistEvaluation,
  DecisionComment,
  DecisionLifecycleStatus
} from "@/types/decisions";

type DecisionMutationErrorPayload = Readonly<{
  error?: string;
  message?: string;
  details?: {
    fieldErrors?: Record<string, string>;
    failedCriteria?: Array<{ id: string; reason: string }>;
    [key: string]: unknown;
  };
}>;

export class DecisionMutationError extends Error {
  public readonly fieldErrors: Record<string, string>;
  public readonly failedCriteria: Array<{ id: string; reason: string }>;

  public constructor(
    message: string,
    options: {
      fieldErrors?: Record<string, string>;
      failedCriteria?: Array<{ id: string; reason: string }>;
    } = {}
  ) {
    super(message);
    this.name = "DecisionMutationError";
    this.fieldErrors = options.fieldErrors ?? {};
    this.failedCriteria = options.failedCriteria ?? [];
  }
}

type DecisionRequestPayload = Readonly<{
  title: string;
  workspaceId?: string | null;
  productId?: string | null;
  framing: {
    decisionQuestion: string;
    context: string;
    ownerId: string;
    priority: "low" | "medium" | "high" | "critical";
    productArea: string;
    segment: string;
    successMetric: string;
    problemStatement: string;
    decisionStatement: string;
    rationale: string;
    optionsConsidered: string[];
  };
}>;

type DecisionMutationResult = Readonly<{
  isSubmitting: boolean;
  error: string | null;
  clearError: () => void;
  createDecision: (payload: DecisionRequestPayload) => Promise<Decision>;
  updateDecision: (decisionId: string, payload: DecisionRequestPayload) => Promise<Decision>;
  transitionDecision: (
    decisionId: string,
    targetStatus: DecisionLifecycleStatus
  ) => Promise<{ decision: Decision; checklist: DecisionChecklistEvaluation }>;
  createComment: (decisionId: string, body: string) => Promise<DecisionComment>;
}>;

function normalizeApiBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

function buildApiUrl(baseUrl: string, path: string): string {
  return `${normalizeApiBaseUrl(baseUrl)}${path}`;
}

async function parseApiResponse<TData>(
  response: Response
): Promise<{ data: TData | null; payload: DecisionMutationErrorPayload | null }> {
  const payload = (await response
    .json()
    .catch(() => null)) as ({ data?: TData } & DecisionMutationErrorPayload) | null;

  return {
    data: payload?.data ?? null,
    payload
  };
}

async function requestMutation<TData>(
  url: string,
  init: RequestInit
): Promise<TData> {
  const response = await fetch(url, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {})
    }
  });

  const { data, payload } = await parseApiResponse<TData>(response);
  if (!response.ok) {
    throw new DecisionMutationError(
      payload?.message ?? "Request failed while updating decision data.",
      {
        fieldErrors: payload?.details?.fieldErrors,
        failedCriteria: payload?.details?.failedCriteria
      }
    );
  }

  if (data === null) {
    throw new DecisionMutationError("API returned no data payload.");
  }

  return data;
}

export function useDecisionMutations(): DecisionMutationResult {
  const { apiBaseUrl } = useRuntimeConfig();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const createDecision = useCallback(
    async (payload: DecisionRequestPayload): Promise<Decision> => {
      setIsSubmitting(true);
      setError(null);
      try {
        const data = await requestMutation<{ decision: Decision }>(
          buildApiUrl(apiBaseUrl, "/decisions"),
          {
            method: "POST",
            body: JSON.stringify(payload)
          }
        );
        return data.decision;
      } catch (mutationError) {
        const message =
          mutationError instanceof Error
            ? mutationError.message
            : "Failed to create decision.";
        setError(message);
        throw mutationError;
      } finally {
        setIsSubmitting(false);
      }
    },
    [apiBaseUrl]
  );

  const updateDecision = useCallback(
    async (decisionId: string, payload: DecisionRequestPayload): Promise<Decision> => {
      setIsSubmitting(true);
      setError(null);
      try {
        const data = await requestMutation<{ decision: Decision }>(
          buildApiUrl(apiBaseUrl, `/decisions/${decisionId}`),
          {
            method: "PATCH",
            body: JSON.stringify(payload)
          }
        );
        return data.decision;
      } catch (mutationError) {
        const message =
          mutationError instanceof Error
            ? mutationError.message
            : "Failed to update decision.";
        setError(message);
        throw mutationError;
      } finally {
        setIsSubmitting(false);
      }
    },
    [apiBaseUrl]
  );

  const transitionDecision = useCallback(
    async (
      decisionId: string,
      targetStatus: DecisionLifecycleStatus
    ): Promise<{ decision: Decision; checklist: DecisionChecklistEvaluation }> => {
      setIsSubmitting(true);
      setError(null);
      try {
        return await requestMutation<{
          decision: Decision;
          checklist: DecisionChecklistEvaluation;
        }>(buildApiUrl(apiBaseUrl, `/decisions/${decisionId}/transition`), {
          method: "POST",
          body: JSON.stringify({ targetStatus })
        });
      } catch (mutationError) {
        const message =
          mutationError instanceof Error
            ? mutationError.message
            : "Failed to transition decision.";
        setError(message);
        throw mutationError;
      } finally {
        setIsSubmitting(false);
      }
    },
    [apiBaseUrl]
  );

  const createComment = useCallback(
    async (decisionId: string, body: string): Promise<DecisionComment> => {
      setIsSubmitting(true);
      setError(null);
      try {
        const data = await requestMutation<{ comment: DecisionComment }>(
          buildApiUrl(apiBaseUrl, `/decisions/${decisionId}/comments`),
          {
            method: "POST",
            body: JSON.stringify({ body })
          }
        );
        return data.comment;
      } catch (mutationError) {
        const message =
          mutationError instanceof Error
            ? mutationError.message
            : "Failed to add comment.";
        setError(message);
        throw mutationError;
      } finally {
        setIsSubmitting(false);
      }
    },
    [apiBaseUrl]
  );

  return {
    isSubmitting,
    error,
    clearError,
    createDecision,
    updateDecision,
    transitionDecision,
    createComment
  };
}
