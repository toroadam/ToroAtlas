import test from "node:test";
import assert from "node:assert/strict";

import { resolveTenantContext, TenantContextError } from "../../auth/clerk.js";
import { tenantContextMiddleware } from "../../middleware/tenantContext.js";

test("resolveTenantContext requires verified Clerk claims and session id", () => {
  assert.throws(
    () => resolveTenantContext(null),
    (error) =>
      error instanceof TenantContextError &&
      error.code === "UNAUTHENTICATED" &&
      /Verified Clerk session claims/.test(error.message),
  );

  assert.throws(
    () =>
      resolveTenantContext({
        sub: "user_1",
        org_id: "org_1",
      }),
    (error) => error instanceof TenantContextError && error.code === "UNAUTHENTICATED",
  );
});

test("tenantContextMiddleware returns 401 when authenticated claims are missing", () => {
  let statusCode: number | undefined;
  let payload: unknown;
  let nextCalled = false;

  tenantContextMiddleware(
    {},
    {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(body: unknown) {
        payload = body;
      },
    },
    () => {
      nextCalled = true;
    },
  );

  assert.equal(nextCalled, false);
  assert.equal(statusCode, 401);
  assert.deepEqual(payload, {
    error: "UNAUTHENTICATED",
    message: "Verified Clerk session claims are required for tenant-scoped access.",
  });
});

test("tenantContextMiddleware uses verified claims and returns 403 when org claim is missing", () => {
  let statusCode: number | undefined;
  let payload: unknown;

  tenantContextMiddleware(
    {
      auth: {
        sessionClaims: {
          sub: "user_1",
          sid: "sess_1",
        },
      },
    },
    {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(body: unknown) {
        payload = body;
      },
    },
    () => {
      assert.fail("next should not be called when org claim is missing");
    },
  );

  assert.equal(statusCode, 403);
  assert.deepEqual(payload, {
    error: "MISSING_ORGANIZATION",
    message: "An active Clerk organization is required for tenant-scoped access.",
  });
});
