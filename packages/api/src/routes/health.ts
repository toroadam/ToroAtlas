import type { TenantRequest, TenantResponse } from "../middleware/tenantContext.js";

type HealthStatus = "ok" | "degraded";

export type HealthRouteRequest = TenantRequest;
export type HealthRouteResponse = TenantResponse;

type HealthCheckPayload = {
  status: HealthStatus;
  service: "api";
  timestamp: string;
  uptimeSeconds: number;
  checks: {
    runtimeStable: boolean;
    loggingConfigured: boolean;
    requiredEnvironment: {
      ok: boolean;
      missing: string[];
    };
  };
};

function resolveMissingRequiredEnvironmentVariables(): string[] {
  const required = ["NODE_ENV"];
  const stagingRequired = ["LOG_LEVEL"];
  const allRequired =
    process.env.APP_ENV === "staging" ? [...required, ...stagingRequired] : required;

  return allRequired.filter((name) => !process.env[name]);
}

export async function getHealthRouteHandler(
  _request: HealthRouteRequest,
  response: HealthRouteResponse,
): Promise<void> {
  const missingEnvironmentVariables = resolveMissingRequiredEnvironmentVariables();
  const loggingConfigured =
    typeof process.env.LOG_LEVEL === "string" && process.env.LOG_LEVEL.length > 0;

  const payload: HealthCheckPayload = {
    status: missingEnvironmentVariables.length === 0 ? "ok" : "degraded",
    service: "api",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    checks: {
      runtimeStable: true,
      loggingConfigured,
      requiredEnvironment: {
        ok: missingEnvironmentVariables.length === 0,
        missing: missingEnvironmentVariables,
      },
    },
  };

  response.status(payload.status === "ok" ? 200 : 503).json({
    data: payload,
  });
}
