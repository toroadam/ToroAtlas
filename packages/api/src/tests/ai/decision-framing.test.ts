import assert from "node:assert/strict";
import test from "node:test";

import type { TenantContext } from "../../auth/clerk.js";
import type { TenantResponse } from "../../middleware/tenantContext.js";
import { InMemoryProductDecisionRepository } from "../../modules/decisions/index.js";
import { suggestDecisionFramingRouteHandler } from "../../routes/ai/decisionFraming.js";
import { createDecisionFramingService } from "../../services/ai/decisionFramingService.js";
import { createDecisionAuditService } from "../../services/audit/auditService.js";

function buildTenantContext(overrides: Partial<TenantContext> = {}): TenantContext {
  return {
    userId: "user_1",
    sessionId: "sess_1",
    organizationId: "org_1",
    workspaceId: "workspace_1",
    productId: "product_1",
    ...overrides,
  };
}

function buildResponseRecorder(): {
  response: TenantResponse;
  read: () => { statusCode?: number; payload?: unknown };
} {
  let statusCode: number | undefined;
  let payload: unknown;
  const response: TenantResponse = {
    status(code: number) {
      statusCode = code;
      return response;
    },
    json(body: unknown) {
      payload = body;
    },
  };
  return {
    response,
    read() {
      return { statusCode, payload };
    },
  };
}

test("AI framing endpoint returns deterministic suggestion payload shape", async () => {
  const decisionFramingService = createDecisionFramingService({
    nowProvider: () => "2026-06-30T00:00:00.000Z",
    idGenerator: () => "fixed-suggestion-id",
  });
  const recorder = buildResponseRecorder();

  await suggestDecisionFramingRouteHandler(
    {
      tenantContext: buildTenantContext(),
      body: {
        topic: "ship staged rollout",
        context: "Decision workflow must reduce rollout risk.",
        productArea: "Decision Workflow",
        segment: "Enterprise",
        successMetric: "Less than 1% regression incidents in staging.",
      },
    },
    recorder.response,
    { decisionFramingService },
  );

  const result = recorder.read();
  assert.equal(result.statusCode, 200);
  const suggestion = (
    result.payload as {
      data: {
        suggestion: Record<string, unknown>;
      };
    }
  ).data.suggestion;

  assert.deepEqual(Object.keys(suggestion).sort(), [
    "advisoryOnly",
    "assumptions",
    "confidence",
    "generatedAt",
    "originalTopic",
    "provider",
    "rationale",
    "rewrittenDecisionQuestion",
    "suggestionId",
    "suggestionType",
  ]);
  assert.equal(suggestion.suggestionType, "decision-question");
  assert.equal(suggestion.suggestionId, "fixed-suggestion-id");
  assert.equal(suggestion.advisoryOnly, true);
  assert.match(
    suggestion.rewrittenDecisionQuestion as string,
    /^What decision should we make about ship staged rollout/i,
  );
});

test("AI framing endpoint rejects malformed provider output with explicit error", async () => {
  const decisionFramingService = createDecisionFramingService({
    provider: {
      async generateSuggestion() {
        return { invalid: "shape" };
      },
    },
  });
  const recorder = buildResponseRecorder();

  await suggestDecisionFramingRouteHandler(
    {
      tenantContext: buildTenantContext(),
      body: {
        topic: "improve deployment safety",
      },
    },
    recorder.response,
    { decisionFramingService },
  );

  const result = recorder.read();
  assert.equal(result.statusCode, 502);
  assert.deepEqual(result.payload, {
    error: "DECISION_CONFLICT",
    message: "AI framing provider returned malformed suggestion output.",
    details: {
      reason: "provider_response_invalid",
    },
  });
});

test("AI framing endpoint handles provider failure with deterministic service error", async () => {
  const decisionFramingService = createDecisionFramingService({
    provider: {
      async generateSuggestion() {
        throw new Error("provider timeout");
      },
    },
  });
  const recorder = buildResponseRecorder();

  await suggestDecisionFramingRouteHandler(
    {
      tenantContext: buildTenantContext(),
      body: {
        topic: "choose release guardrails",
      },
    },
    recorder.response,
    { decisionFramingService },
  );

  const result = recorder.read();
  assert.equal(result.statusCode, 502);
  assert.deepEqual(result.payload, {
    error: "DECISION_CONFLICT",
    message: "AI framing provider is unavailable.",
    details: {
      reason: "provider_unavailable",
    },
  });
});

test("AI framing endpoint records audit event when decisionId is provided", async () => {
  const repository = new InMemoryProductDecisionRepository({
    idGenerator: () => "repo-fixed-id",
    nowProvider: () => "2026-06-30T00:00:00.000Z",
  });
  const decisionFramingService = createDecisionFramingService({
    auditService: createDecisionAuditService({ repository }),
    nowProvider: () => "2026-06-30T00:00:00.000Z",
    idGenerator: () => "suggestion-fixed-id",
  });
  const recorder = buildResponseRecorder();

  await suggestDecisionFramingRouteHandler(
    {
      tenantContext: buildTenantContext(),
      body: {
        decisionId: "decision_123",
        topic: "rollout risk controls",
      },
    },
    recorder.response,
    { decisionFramingService },
  );

  const result = recorder.read();
  assert.equal(result.statusCode, 200);
  const auditEvents = repository.getAuditEvents();
  assert.equal(auditEvents.length, 1);
  assert.deepEqual(auditEvents[0], {
    id: "repo-fixed-id",
    decisionId: "decision_123",
    organizationId: "org_1",
    workspaceId: "workspace_1",
    productId: "product_1",
    eventType: "decision.framing_suggestion_generated",
    actorUserId: "user_1",
    happenedAt: "2026-06-30T00:00:00.000Z",
    payload: {
      suggestionId: "suggestion-fixed-id",
      provider: "heuristic",
      confidence: "medium",
      advisoryOnly: true,
    },
  });
});
