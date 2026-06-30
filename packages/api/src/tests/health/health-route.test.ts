import assert from "node:assert/strict";
import test from "node:test";

import type { TenantResponse } from "../../middleware/tenantContext.js";
import { getHealthRouteHandler } from "../../routes/health.js";

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

test("health route returns ok when required environment variables are present", async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAppEnv = process.env.APP_ENV;
  const originalLogLevel = process.env.LOG_LEVEL;

  process.env.NODE_ENV = "test";
  process.env.APP_ENV = "development";
  process.env.LOG_LEVEL = "info";

  const recorder = buildResponseRecorder();
  await getHealthRouteHandler({}, recorder.response);

  const result = recorder.read();
  assert.equal(result.statusCode, 200);
  const payload = (result.payload as { data: { status: string; checks: { requiredEnvironment: { ok: boolean } } } }).data;
  assert.equal(payload.status, "ok");
  assert.equal(payload.checks.requiredEnvironment.ok, true);

  process.env.NODE_ENV = originalNodeEnv;
  process.env.APP_ENV = originalAppEnv;
  process.env.LOG_LEVEL = originalLogLevel;
});

test("health route returns degraded when staging log level is missing", async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAppEnv = process.env.APP_ENV;
  const originalLogLevel = process.env.LOG_LEVEL;

  process.env.NODE_ENV = "test";
  process.env.APP_ENV = "staging";
  delete process.env.LOG_LEVEL;

  const recorder = buildResponseRecorder();
  await getHealthRouteHandler({}, recorder.response);

  const result = recorder.read();
  assert.equal(result.statusCode, 503);
  const payload = (
    result.payload as {
      data: {
        status: string;
        checks: { requiredEnvironment: { ok: boolean; missing: string[] } };
      };
    }
  ).data;
  assert.equal(payload.status, "degraded");
  assert.equal(payload.checks.requiredEnvironment.ok, false);
  assert.equal(payload.checks.requiredEnvironment.missing.includes("LOG_LEVEL"), true);

  process.env.NODE_ENV = originalNodeEnv;
  process.env.APP_ENV = originalAppEnv;
  process.env.LOG_LEVEL = originalLogLevel;
});
