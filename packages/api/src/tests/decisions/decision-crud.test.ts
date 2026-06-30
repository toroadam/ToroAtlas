import test from "node:test";
import assert from "node:assert/strict";

import type { TenantContext } from "../../auth/clerk.js";
import type { TenantResponse } from "../../middleware/tenantContext.js";
import { InMemoryProductDecisionRepository } from "../../modules/decisions/index.js";
import {
  createDecisionRouteHandler,
  deleteDecisionRouteHandler,
  getDecisionRouteHandler,
  listDecisionsRouteHandler,
  updateDecisionRouteHandler,
  type DecisionRouteRequest,
} from "../../routes/decisions.js";
import { createDecisionService } from "../../services/decisionService.js";

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

const decisionBody = {
  title: "Pick feature flag strategy",
  framing: {
    decisionQuestion: "How should we roll out decision workflow safely?",
    context: "High-risk rollout that needs staged exposure.",
    ownerId: "owner_1",
    priority: "high",
    productArea: "Decision Engine",
    segment: "Enterprise",
    successMetric: "No more than 1% failure in first 24 hours.",
    problemStatement: "Current rollout is all-or-nothing and high risk.",
    decisionStatement: "Adopt cohort-based progressive rollout.",
    rationale: "Progressive rollout reduces blast radius and supports quick rollback.",
    optionsConsidered: ["All users at once", "Cohort progressive rollout"],
  },
} as const;

test("decision CRUD routes support create/list/detail/update/delete with tenant-aware scope", async () => {
  const repository = new InMemoryProductDecisionRepository();
  const decisionService = createDecisionService({ repository });

  const createResponse = buildResponseRecorder();
  const createRequest: DecisionRouteRequest = {
    tenantContext: buildTenantContext(),
    body: decisionBody,
  };
  await createDecisionRouteHandler(createRequest, createResponse.response, { decisionService });
  const createdResult = createResponse.read();
  assert.equal(createdResult.statusCode, 201);
  const createdDecision = (createdResult.payload as { data: { decision: { id: string } } }).data.decision;
  assert.ok(createdDecision.id);

  const listResponse = buildResponseRecorder();
  await listDecisionsRouteHandler(
    { tenantContext: buildTenantContext() },
    listResponse.response,
    { decisionService },
  );
  const listed = listResponse.read();
  assert.equal(listed.statusCode, 200);
  assert.equal((listed.payload as { data: { decisions: unknown[] } }).data.decisions.length, 1);

  const getResponse = buildResponseRecorder();
  await getDecisionRouteHandler(
    { tenantContext: buildTenantContext(), params: { decisionId: createdDecision.id } },
    getResponse.response,
    { decisionService },
  );
  assert.equal(getResponse.read().statusCode, 200);

  const updateResponse = buildResponseRecorder();
  await updateDecisionRouteHandler(
    {
      tenantContext: buildTenantContext(),
      params: { decisionId: createdDecision.id },
      body: {
        title: "Pick controlled feature flag rollout strategy",
      },
    },
    updateResponse.response,
    { decisionService },
  );
  assert.equal(updateResponse.read().statusCode, 200);

  const deleteResponse = buildResponseRecorder();
  await deleteDecisionRouteHandler(
    { tenantContext: buildTenantContext(), params: { decisionId: createdDecision.id } },
    deleteResponse.response,
    { decisionService },
  );
  assert.equal(deleteResponse.read().statusCode, 200);

  const listAfterDeleteResponse = buildResponseRecorder();
  await listDecisionsRouteHandler(
    { tenantContext: buildTenantContext() },
    listAfterDeleteResponse.response,
    { decisionService },
  );
  assert.equal(
    (listAfterDeleteResponse.read().payload as { data: { decisions: unknown[] } }).data.decisions.length,
    0,
  );
});

test("decision CRUD create rejects out-of-scope workspace access", async () => {
  const repository = new InMemoryProductDecisionRepository();
  const decisionService = createDecisionService({ repository });
  const response = buildResponseRecorder();

  await createDecisionRouteHandler(
    {
      tenantContext: buildTenantContext({ workspaceId: "workspace_1" }),
      body: {
        ...decisionBody,
        workspaceId: "workspace_2",
      },
    },
    response.response,
    { decisionService },
  );

  const result = response.read();
  assert.equal(result.statusCode, 403);
  assert.deepEqual(result.payload, {
    error: "INVALID_CONTEXT",
    message: "Workspace scope mismatch for requested resource.",
  });
});

test("decision CRUD update rejects scoped callers clearing workspace scope with null", async () => {
  const repository = new InMemoryProductDecisionRepository();
  const decisionService = createDecisionService({ repository });

  const createResponse = buildResponseRecorder();
  await createDecisionRouteHandler(
    { tenantContext: buildTenantContext(), body: decisionBody },
    createResponse.response,
    { decisionService },
  );
  const decisionId = (
    createResponse.read().payload as {
      data: { decision: { id: string } };
    }
  ).data.decision.id;

  const updateResponse = buildResponseRecorder();
  await updateDecisionRouteHandler(
    {
      tenantContext: buildTenantContext(),
      params: { decisionId },
      body: { workspaceId: null },
    },
    updateResponse.response,
    { decisionService },
  );

  const result = updateResponse.read();
  assert.equal(result.statusCode, 403);
  assert.deepEqual(result.payload, {
    error: "INVALID_CONTEXT",
    message: "Workspace scope mismatch for requested resource.",
  });
});

test("decision CRUD update rejects scoped callers clearing product scope with null", async () => {
  const repository = new InMemoryProductDecisionRepository();
  const decisionService = createDecisionService({ repository });

  const createResponse = buildResponseRecorder();
  await createDecisionRouteHandler(
    { tenantContext: buildTenantContext(), body: decisionBody },
    createResponse.response,
    { decisionService },
  );
  const decisionId = (
    createResponse.read().payload as {
      data: { decision: { id: string } };
    }
  ).data.decision.id;

  const updateResponse = buildResponseRecorder();
  await updateDecisionRouteHandler(
    {
      tenantContext: buildTenantContext(),
      params: { decisionId },
      body: { productId: null },
    },
    updateResponse.response,
    { decisionService },
  );

  const result = updateResponse.read();
  assert.equal(result.statusCode, 403);
  assert.deepEqual(result.payload, {
    error: "INVALID_CONTEXT",
    message: "Product scope mismatch for requested resource.",
  });
});

test("decision detail route denies cross-tenant reads", async () => {
  const repository = new InMemoryProductDecisionRepository();
  const decisionService = createDecisionService({ repository });

  const createResponse = buildResponseRecorder();
  await createDecisionRouteHandler(
    { tenantContext: buildTenantContext(), body: decisionBody },
    createResponse.response,
    { decisionService },
  );
  const decisionId = (
    createResponse.read().payload as {
      data: { decision: { id: string } };
    }
  ).data.decision.id;

  const crossTenantResponse = buildResponseRecorder();
  await getDecisionRouteHandler(
    {
      tenantContext: buildTenantContext({ organizationId: "org_2", workspaceId: "workspace_2", productId: "product_2" }),
      params: { decisionId },
    },
    crossTenantResponse.response,
    { decisionService },
  );

  const result = crossTenantResponse.read();
  assert.equal(result.statusCode, 404);
  assert.deepEqual(result.payload, {
    error: "DECISION_NOT_FOUND",
    message: `Decision '${decisionId}' was not found in the authorized tenant scope.`,
    details: undefined,
  });
});
