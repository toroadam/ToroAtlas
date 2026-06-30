"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRuntimeConfig } from "@/app/providers";
import type {
  Decision,
  DecisionChecklistEvaluation,
  DecisionComment,
  DecisionLifecycleStatus,
  DecisionListFilters
} from "@/types/decisions";

type ApiErrorPayload = Readonly<{
  error?: string;
  message?: string;
  details?: unknown;
}>;

type UseDecisionsResult = Readonly<{
  decisions: Decision[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  reload: () => void;
}>;

type UseDecisionDetailResult = Readonly<{
  decision: Decision | null;
  checklist: DecisionChecklistEvaluation | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  reload: () => void;
}>;

type UseDecisionCommentsResult = Readonly<{
  comments: DecisionComment[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  reload: () => void;
}>;

type UseDecisionAuditsResult = Readonly<{
  timeline: DecisionTimelineEventLike[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  reload: () => void;
}>;

type DecisionTimelineEventLike = Readonly<{
  id: string;
  eventType: string;
  actorUserId: string;
  happenedAt: string;
  payload: Record<string, unknown>;
}>;

type DecisionLifecycleTransitionMap = Readonly<Record<DecisionLifecycleStatus, DecisionLifecycleStatus[]>>;

export const DECISION_TRANSITIONS: DecisionLifecycleTransitionMap = {
  framing: ["research", "archived"],
  research: ["framing", "alignment", "archived"],
  alignment: ["research", "approved", "archived"],
  approved: ["implemented", "superseded"],
  implemented: ["superseded"],
  superseded: ["archived"],
  archived: []
};

const DECISION_LIST_ENDPOINT = "/decisions";
const AUDIT_ENDPOINT = "/decisions/audits";

const LIST_RESPONSE_KEY = "decisions";
const DETAIL_RESPONSE_KEY = "decision";
const CHECKLIST_RESPONSE_KEY = "checklist";
const COMMENTS_RESPONSE_KEY = "comments";
const TIMELINE_RESPONSE_KEY = "events";

function normalizeApiBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

function buildApiUrl(
  baseUrl: string,
  path: string,
  query: Record<string, string | undefined> = {}
): string {
  const url = new URL(`${normalizeApiBaseUrl(baseUrl)}${path}`);
  Object.entries(query).forEach(([key, value]) => {
    if (value && value.trim().length > 0) {
      url.searchParams.set(key, value.trim());
    }
  });
  return url.toString();
}

async function requestJson<TData>(
  url: string,
  init: RequestInit,
  signal: AbortSignal
): Promise<TData> {
  const response = await fetch(url, {
    ...init,
    signal,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {})
    }
  });

  const payload = (await response
    .json()
    .catch(() => null)) as { data?: Record<string, unknown> } & ApiErrorPayload | null;

  if (!response.ok) {
    throw new Error(payload?.message ?? "Request failed while loading decision data.");
  }

  return payload?.data as TData;
}

function sortByUpdatedAtDescending(decisions: Decision[]): Decision[] {
  return [...decisions].sort((left, right) => {
    const leftTime = new Date(left.updatedAt).getTime();
    const rightTime = new Date(right.updatedAt).getTime();
    return rightTime - leftTime;
  });
}

function filterDecisions(decisions: Decision[], filters: DecisionListFilters): Decision[] {
  return decisions.filter((decision) => {
    if (
      filters.ownerId &&
      filters.ownerId.trim().length > 0 &&
      decision.framing.ownerId !== filters.ownerId
    ) {
      return false;
    }

    const query = filters.query?.trim().toLowerCase();
    if (!query) {
      return true;
    }

    const valuesToSearch = [
      decision.title,
      decision.framing.decisionQuestion,
      decision.framing.context,
      decision.framing.productArea,
      decision.framing.segment
    ]
      .join(" ")
      .toLowerCase();

    return valuesToSearch.includes(query);
  });
}

export function useDecisions(filters: DecisionListFilters): UseDecisionsResult {
  const { apiBaseUrl } = useRuntimeConfig();
  const [allDecisions, setAllDecisions] = useState<Decision[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const hasLoadedOnceRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    const fetchList = async (): Promise<void> => {
      const loadingFirstPass = !hasLoadedOnceRef.current;
      if (loadingFirstPass) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setError(null);

      try {
        const data = await requestJson<{ decisions: Decision[] }>(
          buildApiUrl(apiBaseUrl, DECISION_LIST_ENDPOINT, {
            lifecycleStatus:
              filters.lifecycleStatus && filters.lifecycleStatus !== "all"
                ? filters.lifecycleStatus
                : undefined,
            workspaceId: filters.workspaceId,
            productId: filters.productId
          }),
          {
            method: "GET"
          },
          controller.signal
        );
        setAllDecisions(sortByUpdatedAtDescending(data[LIST_RESPONSE_KEY] ?? []));
      } catch (fetchError) {
        if (controller.signal.aborted) {
          return;
        }
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Unable to load decisions from the workspace API."
        );
      } finally {
        if (!controller.signal.aborted) {
          hasLoadedOnceRef.current = true;
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    };

    void fetchList();
    return () => {
      controller.abort();
    };
  }, [
    apiBaseUrl,
    filters.lifecycleStatus,
    filters.productId,
    filters.workspaceId,
    reloadNonce
  ]);

  const decisions = useMemo(
    () => filterDecisions(allDecisions, filters),
    [allDecisions, filters]
  );

  const reload = useCallback(() => {
    setReloadNonce((previous) => previous + 1);
  }, []);

  return {
    decisions,
    isLoading,
    isRefreshing,
    error,
    reload
  };
}

export function useDecisionDetail(decisionId: string): UseDecisionDetailResult {
  const { apiBaseUrl } = useRuntimeConfig();
  const [decision, setDecision] = useState<Decision | null>(null);
  const [checklist, setChecklist] = useState<DecisionChecklistEvaluation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const hasLoadedOnceRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    const fetchDetail = async (): Promise<void> => {
      const loadingFirstPass = !hasLoadedOnceRef.current;
      if (loadingFirstPass) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setError(null);

      try {
        const [detailData, checklistData] = await Promise.all([
          requestJson<{ decision: Decision }>(
            buildApiUrl(apiBaseUrl, `${DECISION_LIST_ENDPOINT}/${decisionId}`),
            {
              method: "GET"
            },
            controller.signal
          ),
          requestJson<{ checklist: DecisionChecklistEvaluation }>(
            buildApiUrl(apiBaseUrl, `${DECISION_LIST_ENDPOINT}/${decisionId}/checklist`),
            {
              method: "GET"
            },
            controller.signal
          )
        ]);

        setDecision(detailData[DETAIL_RESPONSE_KEY] ?? null);
        setChecklist(checklistData[CHECKLIST_RESPONSE_KEY] ?? null);
      } catch (fetchError) {
        if (controller.signal.aborted) {
          return;
        }
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Unable to load decision detail."
        );
      } finally {
        if (!controller.signal.aborted) {
          hasLoadedOnceRef.current = true;
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    };

    if (decisionId.trim().length > 0) {
      void fetchDetail();
    }

    return () => {
      controller.abort();
    };
  }, [apiBaseUrl, decisionId, reloadNonce]);

  const reload = useCallback(() => {
    setReloadNonce((previous) => previous + 1);
  }, []);

  return {
    decision,
    checklist,
    isLoading,
    isRefreshing,
    error,
    reload
  };
}

export function useDecisionComments(decisionId: string): UseDecisionCommentsResult {
  const { apiBaseUrl } = useRuntimeConfig();
  const [comments, setComments] = useState<DecisionComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const hasLoadedOnceRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    const fetchComments = async (): Promise<void> => {
      const loadingFirstPass = !hasLoadedOnceRef.current;
      if (loadingFirstPass) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setError(null);

      try {
        const data = await requestJson<{ comments: DecisionComment[] }>(
          buildApiUrl(apiBaseUrl, `${DECISION_LIST_ENDPOINT}/${decisionId}/comments`),
          {
            method: "GET"
          },
          controller.signal
        );

        const sortedComments = [...(data[COMMENTS_RESPONSE_KEY] ?? [])].sort((left, right) => {
          const leftTime = new Date(left.createdAt).getTime();
          const rightTime = new Date(right.createdAt).getTime();
          return leftTime - rightTime;
        });

        setComments(sortedComments);
      } catch (fetchError) {
        if (controller.signal.aborted) {
          return;
        }
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Unable to load decision comments."
        );
      } finally {
        if (!controller.signal.aborted) {
          hasLoadedOnceRef.current = true;
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    };

    if (decisionId.trim().length > 0) {
      void fetchComments();
    }

    return () => {
      controller.abort();
    };
  }, [apiBaseUrl, decisionId, reloadNonce]);

  const reload = useCallback(() => {
    setReloadNonce((previous) => previous + 1);
  }, []);

  return {
    comments,
    isLoading,
    isRefreshing,
    error,
    reload
  };
}

export function useDecisionTimeline(decisionId: string): UseDecisionAuditsResult {
  const { apiBaseUrl } = useRuntimeConfig();
  const [timeline, setTimeline] = useState<DecisionTimelineEventLike[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const hasLoadedOnceRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    const fetchTimeline = async (): Promise<void> => {
      const loadingFirstPass = !hasLoadedOnceRef.current;
      if (loadingFirstPass) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setError(null);

      try {
        const data = await requestJson<{ events: DecisionTimelineEventLike[] }>(
          buildApiUrl(apiBaseUrl, AUDIT_ENDPOINT, { decisionId }),
          {
            method: "GET"
          },
          controller.signal
        );

        const sortedTimeline = [...(data[TIMELINE_RESPONSE_KEY] ?? [])].sort((left, right) => {
          const leftTime = new Date(left.happenedAt).getTime();
          const rightTime = new Date(right.happenedAt).getTime();
          return rightTime - leftTime;
        });

        setTimeline(sortedTimeline);
      } catch (fetchError) {
        if (controller.signal.aborted) {
          return;
        }
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Unable to load decision timeline."
        );
      } finally {
        if (!controller.signal.aborted) {
          hasLoadedOnceRef.current = true;
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    };

    if (decisionId.trim().length > 0) {
      void fetchTimeline();
    }

    return () => {
      controller.abort();
    };
  }, [apiBaseUrl, decisionId, reloadNonce]);

  const reload = useCallback(() => {
    setReloadNonce((previous) => previous + 1);
  }, []);

  return {
    timeline,
    isLoading,
    isRefreshing,
    error,
    reload
  };
}
