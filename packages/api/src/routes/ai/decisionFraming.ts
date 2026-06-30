import { TenantContextError } from "../../auth/clerk.js";
import {
  requireTenantContext,
  type TenantRequest,
  type TenantResponse,
} from "../../middleware/tenantContext.js";
import { toDecisionDomainError } from "../../modules/decisions/index.js";
import { createLogger, type Logger } from "../../observability/logger.js";
import type { DecisionFramingService } from "../../services/ai/decisionFramingService.js";

export type DecisionFramingRouteRequest = TenantRequest & {
  body?: unknown;
};

export type DecisionFramingRouteResponse = TenantResponse;

export type DecisionFramingRouteDependencies = {
  decisionFramingService: DecisionFramingService;
  logger?: Logger;
};

function sendErrorResponse(response: DecisionFramingRouteResponse, error: unknown): void {
  if (error instanceof TenantContextError) {
    response.status(error.code === "UNAUTHENTICATED" ? 401 : 403).json({
      error: error.code,
      message: error.message,
    });
    return;
  }

  const decisionError = toDecisionDomainError(error);
  response.status(decisionError.statusCode).json({
    error: decisionError.code,
    message: decisionError.message,
    details: decisionError.details,
  });
}

export async function suggestDecisionFramingRouteHandler(
  request: DecisionFramingRouteRequest,
  response: DecisionFramingRouteResponse,
  dependencies: DecisionFramingRouteDependencies,
): Promise<void> {
  const logger = dependencies.logger ?? createLogger("decision-framing-route");
  try {
    const tenantContext = requireTenantContext(request);
    logger.info("Decision framing request received.", {
      organizationId: tenantContext.organizationId,
      workspaceId: tenantContext.workspaceId ?? null,
      productId: tenantContext.productId ?? null,
    });

    const suggestion = await dependencies.decisionFramingService.suggestDecisionQuestion(
      tenantContext,
      request.body,
    );

    logger.info("Decision framing request succeeded.", {
      organizationId: tenantContext.organizationId,
      workspaceId: tenantContext.workspaceId ?? null,
      productId: tenantContext.productId ?? null,
      suggestionId: suggestion.suggestionId,
      provider: suggestion.provider,
    });

    response.status(200).json({
      data: {
        suggestion,
      },
    });
  } catch (error) {
    logger.error("Decision framing request failed.", {
      reason: error instanceof Error ? error.message : "unknown",
    });
    sendErrorResponse(response, error);
  }
}
