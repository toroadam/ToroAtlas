import test from "node:test";
import assert from "node:assert/strict";

import {
  DecisionValidationError,
  PRODUCT_DECISION_LIFECYCLE_STATUSES,
  isLifecycleStatus,
  validateDecisionCreateInput,
  validateDecisionUpdateInput,
} from "../../modules/decisions/index.js";

const validDecisionPayload = {
  title: "Select offline sync strategy for field devices",
  workspaceId: "workspace_1",
  productId: "product_1",
  framing: {
    decisionQuestion: "How should mobile clients synchronize data in offline mode?",
    context: "Field teams frequently operate in low connectivity environments.",
    ownerId: "user_owner",
    priority: "high",
    productArea: "Mobile Experience",
    segment: "Field Service",
    successMetric: "95% successful sync within 60 seconds after reconnection.",
    problemStatement: "Current sync fails frequently after long offline periods.",
    decisionStatement: "Adopt an append-only operation log with conflict replay.",
    rationale: "Operation logs support deterministic conflict resolution and auditing.",
    optionsConsidered: ["Last-write-wins merge", "Operational transform log replay"],
  },
} as const;

test("ProductDecision create schema accepts required framing fields and lifecycle statuses", () => {
  const parsed = validateDecisionCreateInput(validDecisionPayload);
  assert.equal(parsed.title, validDecisionPayload.title);
  assert.deepEqual(parsed.framing.optionsConsidered, validDecisionPayload.framing.optionsConsidered);
  assert.ok(PRODUCT_DECISION_LIFECYCLE_STATUSES.length > 0);
  assert.equal(isLifecycleStatus("approved"), true);
  assert.equal(isLifecycleStatus("not-a-real-status"), false);
});

test("ProductDecision create schema rejects missing required framing fields", () => {
  assert.throws(
    () =>
      validateDecisionCreateInput({
        ...validDecisionPayload,
        framing: {
          ...validDecisionPayload.framing,
          decisionQuestion: " ",
          optionsConsidered: [],
        },
      }),
    (error) => {
      assert.ok(error instanceof DecisionValidationError);
      assert.equal(error.code, "DECISION_VALIDATION_ERROR");
      assert.match(error.message, /framing fields failed validation/i);
      assert.deepEqual(error.details, {
        fieldErrors: {
          "framing.decisionQuestion": "This framing field is required.",
          "framing.optionsConsidered": "Provide at least one non-empty option.",
        },
      });
      return true;
    },
  );
});

test("ProductDecision update schema rejects unknown framing field patches", () => {
  assert.throws(
    () =>
      validateDecisionUpdateInput({
        framing: {
          unknownField: "value",
        },
      }),
    (error) => {
      assert.ok(error instanceof DecisionValidationError);
      assert.equal(error.code, "DECISION_VALIDATION_ERROR");
      assert.deepEqual(error.details, {
        fieldErrors: {
          "framing.unknownField": "Unknown framing field.",
        },
      });
      return true;
    },
  );
});
