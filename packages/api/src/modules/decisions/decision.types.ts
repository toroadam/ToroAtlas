export const PRODUCT_DECISION_LIFECYCLE_STATUSES = [
  "framing",
  "research",
  "alignment",
  "approved",
  "implemented",
  "superseded",
  "archived",
] as const;

export type ProductDecisionLifecycleStatus = (typeof PRODUCT_DECISION_LIFECYCLE_STATUSES)[number];

export const PRODUCT_DECISION_PRIORITIES = ["low", "medium", "high", "critical"] as const;
export type ProductDecisionPriority = (typeof PRODUCT_DECISION_PRIORITIES)[number];

export type ProductDecisionFraming = {
  decisionQuestion: string;
  context: string;
  ownerId: string;
  priority: ProductDecisionPriority;
  productArea: string;
  segment: string;
  successMetric: string;
  problemStatement: string;
  decisionStatement: string;
  rationale: string;
  optionsConsidered: string[];
};

export type ProductDecision = {
  id: string;
  organizationId: string;
  workspaceId: string | null;
  productId: string | null;
  title: string;
  framing: ProductDecisionFraming;
  lifecycleStatus: ProductDecisionLifecycleStatus;
  createdByUserId: string;
  updatedByUserId: string;
  createdAt: string;
  updatedAt: string;
  transitionedAt: string | null;
};

export type ProductDecisionComment = {
  id: string;
  decisionId: string;
  organizationId: string;
  workspaceId: string | null;
  productId: string | null;
  body: string;
  createdByUserId: string;
  createdAt: string;
};

export type ProductDecisionAuditEvent = {
  id: string;
  decisionId: string;
  organizationId: string;
  workspaceId: string | null;
  productId: string | null;
  eventType: string;
  actorUserId: string;
  happenedAt: string;
  payload: Record<string, unknown>;
};

export type ProductDecisionChecklistItem = {
  id: string;
  label: string;
  passed: boolean;
  reason: string;
};

export type ProductDecisionChecklistEvaluation = {
  isComplete: boolean;
  completionRatio: number;
  items: ProductDecisionChecklistItem[];
};

export type ProductDecisionScope = {
  organizationId: string;
  workspaceId?: string | null;
  productId?: string | null;
};

export type ProductDecisionCreateInput = {
  title: string;
  workspaceId?: string | null;
  productId?: string | null;
  framing: ProductDecisionFraming;
};

export type ProductDecisionUpdateInput = {
  title?: string;
  framing?: Partial<ProductDecisionFraming>;
  workspaceId?: string | null;
  productId?: string | null;
};
