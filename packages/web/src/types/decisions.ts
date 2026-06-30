export const DECISION_LIFECYCLE_STATUSES = [
  "framing",
  "research",
  "alignment",
  "approved",
  "implemented",
  "superseded",
  "archived"
] as const;

export type DecisionLifecycleStatus = (typeof DECISION_LIFECYCLE_STATUSES)[number];

export const DECISION_PRIORITIES = ["low", "medium", "high", "critical"] as const;
export type DecisionPriority = (typeof DECISION_PRIORITIES)[number];

export type DecisionFraming = Readonly<{
  decisionQuestion: string;
  context: string;
  ownerId: string;
  priority: DecisionPriority;
  productArea: string;
  segment: string;
  successMetric: string;
  problemStatement: string;
  decisionStatement: string;
  rationale: string;
  optionsConsidered: string[];
}>;

export type Decision = Readonly<{
  id: string;
  organizationId: string;
  workspaceId: string | null;
  productId: string | null;
  title: string;
  framing: DecisionFraming;
  lifecycleStatus: DecisionLifecycleStatus;
  createdByUserId: string;
  updatedByUserId: string;
  createdAt: string;
  updatedAt: string;
  transitionedAt: string | null;
}>;

export type DecisionComment = Readonly<{
  id: string;
  decisionId: string;
  organizationId: string;
  workspaceId: string | null;
  productId: string | null;
  body: string;
  createdByUserId: string;
  createdAt: string;
}>;

export type DecisionChecklistItem = Readonly<{
  id: string;
  label: string;
  passed: boolean;
  reason: string;
}>;

export type DecisionChecklistEvaluation = Readonly<{
  isComplete: boolean;
  completionRatio: number;
  items: DecisionChecklistItem[];
}>;

export type DecisionTimelineEvent = Readonly<{
  id: string;
  decisionId: string;
  organizationId: string;
  workspaceId: string | null;
  productId: string | null;
  eventType: string;
  actorUserId: string;
  happenedAt: string;
  payload: Record<string, unknown>;
}>;

export type DecisionFramingSuggestion = Readonly<{
  suggestionId: string;
  suggestionType: "decision-question";
  advisoryOnly: true;
  originalTopic: string;
  rewrittenDecisionQuestion: string;
  rationale: string;
  assumptions: string[];
  confidence: "low" | "medium" | "high";
  provider: "heuristic" | "model";
  generatedAt: string;
}>;

export type DecisionListFilters = Readonly<{
  lifecycleStatus?: DecisionLifecycleStatus | "all";
  ownerId?: string;
  workspaceId?: string;
  productId?: string;
  query?: string;
}>;
