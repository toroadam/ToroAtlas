import {
  PRODUCT_DECISION_LIFECYCLE_STATUSES,
  PRODUCT_DECISION_PRIORITIES,
  type ProductDecisionCreateInput,
  type ProductDecisionFraming,
  type ProductDecisionLifecycleStatus,
  type ProductDecisionUpdateInput,
} from "./decision.types.js";
import { DecisionValidationError } from "./decision.errors.js";

const REQUIRED_FRAMING_FIELDS: (keyof ProductDecisionFraming)[] = [
  "decisionQuestion",
  "context",
  "ownerId",
  "priority",
  "productArea",
  "segment",
  "successMetric",
  "problemStatement",
  "decisionStatement",
  "rationale",
  "optionsConsidered",
];

type StringField = Exclude<keyof ProductDecisionFraming, "priority" | "optionsConsidered">;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isLifecycleStatus(value: unknown): value is ProductDecisionLifecycleStatus {
  return typeof value === "string" && PRODUCT_DECISION_LIFECYCLE_STATUSES.includes(
    value as ProductDecisionLifecycleStatus,
  );
}

function assertValidFramingInput(input: unknown): asserts input is ProductDecisionFraming {
  if (!input || typeof input !== "object") {
    throw new DecisionValidationError(
      "Decision framing fields are required.",
      { framing: "Provide a framing payload with all required fields." },
    );
  }

  const framing = input as Record<string, unknown>;
  const fieldErrors: Record<string, string> = {};
  const stringFields = REQUIRED_FRAMING_FIELDS.filter((field) => field !== "priority" && field !== "optionsConsidered");

  for (const fieldName of stringFields as StringField[]) {
    if (!isNonEmptyString(framing[fieldName])) {
      fieldErrors[`framing.${fieldName}`] = "This framing field is required.";
    }
  }

  const priority = framing.priority;
  if (typeof priority !== "string" || !PRODUCT_DECISION_PRIORITIES.includes(priority as ProductDecisionFraming["priority"])) {
    fieldErrors["framing.priority"] = `Priority must be one of: ${PRODUCT_DECISION_PRIORITIES.join(", ")}.`;
  }

  const options = framing.optionsConsidered;
  if (!Array.isArray(options) || options.length === 0 || options.some((entry) => !isNonEmptyString(entry))) {
    fieldErrors["framing.optionsConsidered"] = "Provide at least one non-empty option.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new DecisionValidationError(
      "Decision framing fields failed validation.",
      fieldErrors,
    );
  }
}

export function validateDecisionCreateInput(input: unknown): ProductDecisionCreateInput {
  if (!input || typeof input !== "object") {
    throw new DecisionValidationError(
      "Decision payload is required.",
      { body: "Provide a request payload." },
    );
  }

  const payload = input as Record<string, unknown>;
  const fieldErrors: Record<string, string> = {};
  const title = payload.title;
  let normalizedTitle: string | undefined;

  if (!isNonEmptyString(title)) {
    fieldErrors.title = "Decision title is required.";
  } else {
    normalizedTitle = title.trim();
  }

  if ("workspaceId" in payload && payload.workspaceId !== null && !isNonEmptyString(payload.workspaceId)) {
    fieldErrors.workspaceId = "workspaceId must be a non-empty string or null.";
  }

  if ("productId" in payload && payload.productId !== null && !isNonEmptyString(payload.productId)) {
    fieldErrors.productId = "productId must be a non-empty string or null.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new DecisionValidationError(
      "Decision payload failed validation.",
      fieldErrors,
    );
  }

  assertValidFramingInput(payload.framing);

  return {
    title: normalizedTitle as string,
    workspaceId: payload.workspaceId === undefined ? undefined : payload.workspaceId as string | null,
    productId: payload.productId === undefined ? undefined : payload.productId as string | null,
    framing: payload.framing,
  };
}

export function validateDecisionUpdateInput(input: unknown): ProductDecisionUpdateInput {
  if (!input || typeof input !== "object") {
    throw new DecisionValidationError(
      "Decision update payload is required.",
      { body: "Provide update fields." },
    );
  }

  const payload = input as Record<string, unknown>;
  const update: ProductDecisionUpdateInput = {};
  const fieldErrors: Record<string, string> = {};

  if ("title" in payload) {
    if (!isNonEmptyString(payload.title)) {
      fieldErrors.title = "Decision title must be a non-empty string.";
    } else {
      update.title = payload.title.trim();
    }
  }

  if ("workspaceId" in payload) {
    if (payload.workspaceId !== null && !isNonEmptyString(payload.workspaceId)) {
      fieldErrors.workspaceId = "workspaceId must be a non-empty string or null.";
    } else {
      update.workspaceId = payload.workspaceId as string | null;
    }
  }

  if ("productId" in payload) {
    if (payload.productId !== null && !isNonEmptyString(payload.productId)) {
      fieldErrors.productId = "productId must be a non-empty string or null.";
    } else {
      update.productId = payload.productId as string | null;
    }
  }

  if ("framing" in payload) {
    if (!payload.framing || typeof payload.framing !== "object") {
      fieldErrors.framing = "framing must be an object when provided.";
    } else {
      const framingPatch = payload.framing as Record<string, unknown>;
      const sanitizedPatch: Partial<ProductDecisionFraming> = {};

      for (const [fieldName, value] of Object.entries(framingPatch)) {
        if (!REQUIRED_FRAMING_FIELDS.includes(fieldName as keyof ProductDecisionFraming)) {
          fieldErrors[`framing.${fieldName}`] = "Unknown framing field.";
          continue;
        }

        if (fieldName === "priority") {
          if (typeof value !== "string" || !PRODUCT_DECISION_PRIORITIES.includes(value as ProductDecisionFraming["priority"])) {
            fieldErrors["framing.priority"] = `Priority must be one of: ${PRODUCT_DECISION_PRIORITIES.join(", ")}.`;
            continue;
          }
          sanitizedPatch.priority = value as ProductDecisionFraming["priority"];
          continue;
        }

        if (fieldName === "optionsConsidered") {
          if (!Array.isArray(value) || value.length === 0 || value.some((entry) => !isNonEmptyString(entry))) {
            fieldErrors["framing.optionsConsidered"] = "Provide at least one non-empty option.";
            continue;
          }
          sanitizedPatch.optionsConsidered = value.map((entry) => entry.trim());
          continue;
        }

        if (!isNonEmptyString(value)) {
          fieldErrors[`framing.${fieldName}`] = "This framing field must be a non-empty string.";
          continue;
        }

        sanitizedPatch[fieldName as StringField] = value.trim();
      }

      update.framing = sanitizedPatch;
    }
  }

  if (Object.keys(update).length === 0) {
    fieldErrors.body = "No valid update fields provided.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new DecisionValidationError(
      "Decision update payload failed validation.",
      fieldErrors,
    );
  }

  return update;
}
