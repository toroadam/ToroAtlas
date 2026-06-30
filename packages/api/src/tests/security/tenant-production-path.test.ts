import test from "node:test";
import assert from "node:assert/strict";

import {
  tenantContextMiddleware,
  type TenantRequest,
  type TenantResponse,
} from "../../middleware/tenantContext.js";
import { getTenantScopeRouteHandler } from "../../routes/tenantScopeRoute.js";
import type { TenantScopePrismaClient } from "../../repositories/tenantScopeRepository.js";

test("tenant scope production route resolves tenant context before tenant-scoped DB transaction", async () => {
  const executionOrder: string[] = [];
  const rawStatements: string[] = [];

  const request: TenantRequest = {
    auth: {
      sessionClaims: {
        sub: "user_123",
        sid: "sess_123",
        org_id: "org_123",
        workspace_id: "workspace_123",
        product_id: "product_123",
      },
    },
  };

  let statusCode: number | undefined;
  let responsePayload: unknown;
  const response: TenantResponse = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(payload: unknown) {
      responsePayload = payload;
    },
  };

  let nextCalled = false;
  tenantContextMiddleware(request, response, () => {
    executionOrder.push("tenant-context:resolved");
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(request.tenantContext?.organizationId, "org_123");

  const prismaClient: TenantScopePrismaClient = {
    async $transaction(transactionFn) {
      executionOrder.push("transaction:start");
      const result = await transactionFn({
        async $executeRawUnsafe(statement: string) {
          rawStatements.push(statement);
          executionOrder.push(`session:${statement}`);
          return null;
        },
        async $queryRawUnsafe<TResult>(_statement: string) {
          executionOrder.push("query:tenant-scope");
          return [
            {
              userId: "user_123",
              organizationId: "org_123",
              workspaceId: "workspace_123",
              productId: "product_123",
            },
          ] as TResult;
        },
      });
      executionOrder.push("transaction:end");
      return result;
    },
  };

  await getTenantScopeRouteHandler(request, response, { prismaClient });

  assert.equal(statusCode, 200);
  assert.deepEqual(responsePayload, {
    tenantScope: {
      userId: "user_123",
      organizationId: "org_123",
      workspaceId: "workspace_123",
      productId: "product_123",
    },
  });

  assert.equal(rawStatements.length, 4);
  assert.match(rawStatements[0], /SET LOCAL app\.current_user_id = 'user_123';/);
  assert.match(rawStatements[1], /SET LOCAL app\.organization_id = 'org_123';/);
  assert.match(rawStatements[2], /SET LOCAL app\.workspace_id = 'workspace_123';/);
  assert.match(rawStatements[3], /SET LOCAL app\.product_id = 'product_123';/);

  const middlewareResolvedIndex = executionOrder.indexOf("tenant-context:resolved");
  const firstSessionStatementIndex = executionOrder.findIndex((step) => step.startsWith("session:"));
  const tenantQueryIndex = executionOrder.indexOf("query:tenant-scope");
  assert.ok(middlewareResolvedIndex !== -1);
  assert.ok(firstSessionStatementIndex > middlewareResolvedIndex);
  assert.ok(tenantQueryIndex > firstSessionStatementIndex);
});

test("tenant scope production route returns 403 when tenant context is not resolved", async () => {
  let statusCode: number | undefined;
  let responsePayload: unknown;
  const response: TenantResponse = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(payload: unknown) {
      responsePayload = payload;
    },
  };

  const prismaClient: TenantScopePrismaClient = {
    async $transaction() {
      throw new Error("transaction should not run when tenant context is missing");
    },
  };

  await getTenantScopeRouteHandler({}, response, { prismaClient });

  assert.equal(statusCode, 403);
  assert.deepEqual(responsePayload, {
    error: "INVALID_CONTEXT",
    message: "Tenant context has not been resolved for this request.",
  });
});
