import { DecisionDomainError } from "../modules/decisions/decision.errors.js";
import type {
  ProductDecision,
  ProductDecisionChecklistEvaluation,
  ProductDecisionChecklistItem,
  ProductDecisionLifecycleStatus,
} from "../modules/decisions/decision.types.js";

export const DECISION_LIFECYCLE_TRANSITIONS: Record<
  ProductDecisionLifecycleStatus,
  ProductDecisionLifecycleStatus[]
> = {
  framing: ["research", "archived"],
  research: ["framing", "alignment", "archived"],
  alignment: ["research", "approved", "archived"],
  approved: ["implemented", "superseded"],
  implemented: ["superseded"],
  superseded: ["archived"],
  archived: [],
};

const CHECKLIST_ITEMS: {
  id: string;
  label: string;
  evaluate: (decision: ProductDecision) => boolean;
  failureReason: string;
}[] = [
  {
    id: "decision-question",
    label: "Decision question is defined",
    evaluate: (decision) => decision.framing.decisionQuestion.trim().length >= 10,
    failureReason: "decisionQuestion must include at least 10 characters.",
  },
  {
    id: "business-context",
    label: "Business context is documented",
    evaluate: (decision) => decision.framing.context.trim().length >= 10,
    failureReason: "context must include at least 10 characters.",
  },
  {
    id: "owner-assigned",
    label: "Decision owner is assigned",
    evaluate: (decision) => decision.framing.ownerId.trim().length > 0,
    failureReason: "ownerId is required.",
  },
  {
    id: "options-considered",
    label: "At least one option is captured",
    evaluate: (decision) => decision.framing.optionsConsidered.length > 0,
    failureReason: "At least one optionsConsidered entry is required.",
  },
  {
    id: "problem-defined",
    label: "Problem statement is defined",
    evaluate: (decision) => decision.framing.problemStatement.trim().length >= 10,
    failureReason: "problemStatement must include at least 10 characters.",
  },
  {
    id: "decision-defined",
    label: "Decision statement is defined",
    evaluate: (decision) => decision.framing.decisionStatement.trim().length >= 10,
    failureReason: "decisionStatement must include at least 10 characters.",
  },
  {
    id: "rationale-defined",
    label: "Rationale is documented",
    evaluate: (decision) => decision.framing.rationale.trim().length >= 10,
    failureReason: "rationale must include at least 10 characters.",
  },
  {
    id: "success-metric-defined",
    label: "Success metric is measurable",
    evaluate: (decision) => decision.framing.successMetric.trim().length >= 10,
    failureReason: "successMetric must include at least 10 characters.",
  },
];

const CHECKLIST_REQUIRED_BY_TARGET_STATUS: Partial<
  Record<ProductDecisionLifecycleStatus, string[]>
> = {
  alignment: ["decision-question", "business-context", "owner-assigned", "options-considered"],
  approved: CHECKLIST_ITEMS.map((item) => item.id),
  implemented: CHECKLIST_ITEMS.map((item) => item.id),
};

export function getAllowedDecisionTransitions(
  currentStatus: ProductDecisionLifecycleStatus,
): ProductDecisionLifecycleStatus[] {
  return DECISION_LIFECYCLE_TRANSITIONS[currentStatus];
}

export function evaluateDecisionChecklist(
  decision: ProductDecision,
): ProductDecisionChecklistEvaluation {
  const items: ProductDecisionChecklistItem[] = CHECKLIST_ITEMS.map((item) => {
    const passed = item.evaluate(decision);
    return {
      id: item.id,
      label: item.label,
      passed,
      reason: passed ? "ok" : item.failureReason,
    };
  });

  const passedCount = items.filter((item) => item.passed).length;
  const completionRatio = items.length === 0 ? 1 : passedCount / items.length;
  return {
    isComplete: passedCount === items.length,
    completionRatio,
    items,
  };
}

export function assertDecisionTransitionAllowed(
  decision: ProductDecision,
  targetStatus: ProductDecisionLifecycleStatus,
  checklistEvaluation: ProductDecisionChecklistEvaluation,
): void {
  const allowed = getAllowedDecisionTransitions(decision.lifecycleStatus);
  if (!allowed.includes(targetStatus)) {
    throw new DecisionDomainError(
      "DECISION_TRANSITION_NOT_ALLOWED",
      `Decision cannot transition from '${decision.lifecycleStatus}' to '${targetStatus}'.`,
      409,
      {
        from: decision.lifecycleStatus,
        to: targetStatus,
        allowedTransitions: allowed,
      },
    );
  }

  const requiredChecklistItems = CHECKLIST_REQUIRED_BY_TARGET_STATUS[targetStatus] ?? [];
  const failedRequiredItems = checklistEvaluation.items
    .filter((item) => requiredChecklistItems.includes(item.id))
    .filter((item) => !item.passed);

  if (failedRequiredItems.length > 0) {
    throw new DecisionDomainError(
      "DECISION_CHECKLIST_INCOMPLETE",
      `Decision checklist requirements are not met for transition to '${targetStatus}'.`,
      422,
      {
        targetStatus,
        failedCriteria: failedRequiredItems.map((item) => ({
          id: item.id,
          reason: item.reason,
        })),
      },
    );
  }
}

export function validateCommentBody(input: unknown): string {
  if (typeof input !== "string") {
    throw new DecisionDomainError(
      "DECISION_VALIDATION_ERROR",
      "Comment body is required.",
      400,
      {
        fieldErrors: {
          body: "Comment body must be a non-empty string.",
        },
      },
    );
  }

  const body = input.trim();
  if (!body) {
    throw new DecisionDomainError(
      "DECISION_VALIDATION_ERROR",
      "Comment body cannot be empty.",
      400,
      {
        fieldErrors: {
          body: "Comment body must be a non-empty string.",
        },
      },
    );
  }

  return body;
}
