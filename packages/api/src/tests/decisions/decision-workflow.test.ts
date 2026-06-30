import test from "node:test";
import assert from "node:assert/strict";

import type { TenantContext } from "../../auth/clerk.js";
import type { TenantResponse } from "../../middleware/tenantContext.js";
import { InMemoryProductDecisionRepository } from "../../modules/decisions/index.js";
import {
  createDecisionCommentRouteHandler,
  createDecisionRouteHandler,
  getDecisionChecklistRouteHandler,
  listDecisionCommentsRouteHandler,
  transitionDecisionRouteHandler,
  type DecisionRouteRequest,
} from "../../routes/decisions.js";
import { createDecisionService } from "../../services/decisionService.js";
import {
  DECISION_LIFECYCLE_TRANSITIONS,
  evaluateDecisionChecklist,
} from "../../services/decisionWorkflow.js";

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

const validDecisionBody = {
  title: "Choose event backbone",
  framing: {
    decisionQuestion: "How should events be transported between workflow services?",
    context: "We need auditable, reliable, replayable event delivery.",
    ownerId: "owner_1",
    priority: "high",
    productArea: "Platform",
    segment: "B2B",
    successMetric: "Process 99.9% events within 2 minutes.",
    problemStatement: "Current workflow integrations fail under retry storms.",
    decisionStatement: "Use durable queue + idempotent consumers.",
    rationale: "Durable queue with idempotency minimizes duplicate side effects.",
    optionsConsidered: ["Direct HTTP fan-out", "Durable queue"],
  },
} as const;

test("workflow transition guard returns deterministic errors for invalid requests", async () => {
  const repository = new InMemoryProductDecisionRepository();
  const decisionService = createDecisionService({ repository });

  const createResponse = buildResponseRecorder();
  await createDecisionRouteHandler(
    {
      tenantContext: buildTenantContext(),
      body: {
        ...validDecisionBody,
        framing: {
          ...validDecisionBody.framing,
          rationale: "short",
        },
      },
    },
    createResponse.response,
    { decisionService },
  );
  const decisionId = (
    createResponse.read().payload as {
      data: { decision: { id: string } };
    }
  ).data.decision.id;

  const transitionResponse = buildResponseRecorder();
  await transitionDecisionRouteHandler(
    {
      tenantContext: buildTenantContext(),
      params: { decisionId },
      body: { targetStatus: "approved" },
    },
    transitionResponse.response,
    { decisionService },
  );

  const transitionResult = transitionResponse.read();
  assert.equal(transitionResult.statusCode, 409);
  assert.deepEqual(transitionResult.payload, {
    error: "DECISION_TRANSITION_NOT_ALLOWED",
    message: "Decision cannot transition from 'framing' to 'approved'.",
    details: {
      from: "framing",
      to: "approved",
      allowedTransitions: DECISION_LIFECYCLE_TRANSITIONS.framing,
    },
  });

  test("workflow checklist enforcement blocks approved transition when required criteria fail", async () => {
    const repository = new InMemoryProductDecisionRepository();
    const decisionService = createDecisionService({ repository });

    const createResponse = buildResponseRecorder();
    await createDecisionRouteHandler(
      {
        tenantContext: buildTenantContext(),
        body: {
          ...validDecisionBody,
          framing: {
            ...validDecisionBody.framing,
            rationale: "short",
          },
        },
      },
      createResponse.response,
      { decisionService },
    );
    const decisionId = (
      createResponse.read().payload as {
        data: { decision: { id: string } };
      }
    ).data.decision.id;

    const toResearch = buildResponseRecorder();
    await transitionDecisionRouteHandler(
      {
        tenantContext: buildTenantContext(),
        params: { decisionId },
        body: { targetStatus: "research" },
      },
      toResearch.response,
      { decisionService },
    );
    assert.equal(toResearch.read().statusCode, 200);

    const toAlignment = buildResponseRecorder();
    await transitionDecisionRouteHandler(
      {
        tenantContext: buildTenantContext(),
        params: { decisionId },
        body: { targetStatus: "alignment" },
      },
      toAlignment.response,
      { decisionService },
    );
    assert.equal(toAlignment.read().statusCode, 200);

    const toApproved = buildResponseRecorder();
    await transitionDecisionRouteHandler(
      {
        tenantContext: buildTenantContext(),
        params: { decisionId },
        body: { targetStatus: "approved" },
      },
      toApproved.response,
      { decisionService },
    );

    const approvedResult = toApproved.read();
    assert.equal(approvedResult.statusCode, 422);
    assert.deepEqual(approvedResult.payload, {
      error: "DECISION_CHECKLIST_INCOMPLETE",
      message: "Decision checklist requirements are not met for transition to 'approved'.",
      details: {
        targetStatus: "approved",
        failedCriteria: [
          {
            id: "rationale-defined",
            reason: "rationale must include at least 10 characters.",
          },
        ],
      },
    });
  });
});

test("workflow checklist endpoint returns deterministic criterion-level results", async () => {
  const repository = new InMemoryProductDecisionRepository();
  const decisionService = createDecisionService({ repository });

  const createResponse = buildResponseRecorder();
  await createDecisionRouteHandler(
    {
      tenantContext: buildTenantContext(),
      body: validDecisionBody,
    },
    createResponse.response,
    { decisionService },
  );
  const decisionId = (
    createResponse.read().payload as {
      data: { decision: { id: string } };
    }
  ).data.decision.id;

  const checklistResponse = buildResponseRecorder();
  await getDecisionChecklistRouteHandler(
    {
      tenantContext: buildTenantContext(),
      params: { decisionId },
    },
    checklistResponse.response,
    { decisionService },
  );
  const checklistResult = checklistResponse.read();
  assert.equal(checklistResult.statusCode, 200);
  const checklist = (checklistResult.payload as { data: { checklist: ReturnType<typeof evaluateDecisionChecklist> } }).data.checklist;
  assert.equal(checklist.items.length > 0, true);
  assert.equal(checklist.items.every((item) => typeof item.reason === "string"), true);
});

test("comments API creates and lists comments only within tenant scope", async () => {
  const repository = new InMemoryProductDecisionRepository();
  const decisionService = createDecisionService({ repository });

  const createResponse = buildResponseRecorder();
  await createDecisionRouteHandler(
    {
      tenantContext: buildTenantContext(),
      body: validDecisionBody,
    },
    createResponse.response,
    { decisionService },
  );
  const decisionId = (
    createResponse.read().payload as {
      data: { decision: { id: string } };
    }
  ).data.decision.id;

  const addCommentResponse = buildResponseRecorder();
  await createDecisionCommentRouteHandler(
    {
      tenantContext: buildTenantContext(),
      params: { decisionId },
      body: { body: "Ship behind a rollout gate for one sprint." },
    },
    addCommentResponse.response,
    { decisionService },
  );
  assert.equal(addCommentResponse.read().statusCode, 201);

  const listCommentsResponse = buildResponseRecorder();
  await listDecisionCommentsRouteHandler(
    {
      tenantContext: buildTenantContext(),
      params: { decisionId },
    },
    listCommentsResponse.response,
    { decisionService },
  );
  const listed = listCommentsResponse.read();
  assert.equal(listed.statusCode, 200);
  assert.equal((listed.payload as { data: { comments: unknown[] } }).data.comments.length, 1);

  const crossTenantListResponse = buildResponseRecorder();
  await listDecisionCommentsRouteHandler(
    {
      tenantContext: buildTenantContext({ organizationId: "org_2", workspaceId: "workspace_2", productId: "product_2" }),
      params: { decisionId },
    },
    crossTenantListResponse.response,
    { decisionService },
  );
  const crossTenantResult = crossTenantListResponse.read();
  assert.equal(crossTenantResult.statusCode, 404);
  assert.deepEqual(crossTenantResult.payload, {
    error: "DECISION_NOT_FOUND",
    message: `Decision '${decisionId}' was not found in the authorized tenant scope.`,
    details: undefined,
  });
});
