import { TenantContextError } from "../auth/clerk.js";
import { requireTenantContext, type TenantRequest, type TenantResponse } from "../middleware/tenantContext.js";
import { DecisionDomainError, toDecisionDomainError } from "../modules/decisions/index.js";
import type { DecisionService } from "../services/decisionService.js";

export type DecisionRouteRequest = TenantRequest & {
  params?: Record<string, string | undefined>;
  query?: Record<string, string | undefined>;
  body?: unknown;
};

export type DecisionRouteResponse = TenantResponse;

export type DecisionRouteDependencies = {
  decisionService: DecisionService;
};

function sendErrorResponse(response: DecisionRouteResponse, error: unknown): void {
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

function getDecisionIdFromParams(request: DecisionRouteRequest): string {
  const decisionId = request.params?.decisionId?.trim();
  if (!decisionId) {
    throw new DecisionDomainError(
      "DECISION_VALIDATION_ERROR",
      "Route parameter 'decisionId' is required.",
      400,
      {
        fieldErrors: {
          decisionId: "Provide a decisionId in route params.",
        },
      },
    );
  }
  return decisionId;
}

export async function createDecisionRouteHandler(
  request: DecisionRouteRequest,
  response: DecisionRouteResponse,
  dependencies: DecisionRouteDependencies,
): Promise<void> {
  try {
    const tenantContext = requireTenantContext(request);
    const decision = await dependencies.decisionService.createDecision(tenantContext, request.body);

    response.status(201).json({
      data: {
        decision,
      },
    });
  } catch (error) {
    sendErrorResponse(response, error);
  }
}

export async function listDecisionsRouteHandler(
  request: DecisionRouteRequest,
  response: DecisionRouteResponse,
  dependencies: DecisionRouteDependencies,
): Promise<void> {
  try {
    const tenantContext = requireTenantContext(request);
    const decisions = await dependencies.decisionService.listDecisions(tenantContext, {
      lifecycleStatus: request.query?.lifecycleStatus as
        | "framing"
        | "research"
        | "alignment"
        | "approved"
        | "implemented"
        | "superseded"
        | "archived"
        | undefined,
      workspaceId: request.query?.workspaceId ?? undefined,
      productId: request.query?.productId ?? undefined,
    });

    response.status(200).json({
      data: {
        decisions,
      },
    });
  } catch (error) {
    sendErrorResponse(response, error);
  }
}

export async function getDecisionRouteHandler(
  request: DecisionRouteRequest,
  response: DecisionRouteResponse,
  dependencies: DecisionRouteDependencies,
): Promise<void> {
  try {
    const tenantContext = requireTenantContext(request);
    const decisionId = getDecisionIdFromParams(request);
    const decision = await dependencies.decisionService.getDecision(tenantContext, decisionId);

    response.status(200).json({
      data: {
        decision,
      },
    });
  } catch (error) {
    sendErrorResponse(response, error);
  }
}

export async function updateDecisionRouteHandler(
  request: DecisionRouteRequest,
  response: DecisionRouteResponse,
  dependencies: DecisionRouteDependencies,
): Promise<void> {
  try {
    const tenantContext = requireTenantContext(request);
    const decisionId = getDecisionIdFromParams(request);
    const decision = await dependencies.decisionService.updateDecision(
      tenantContext,
      decisionId,
      request.body,
    );

    response.status(200).json({
      data: {
        decision,
      },
    });
  } catch (error) {
    sendErrorResponse(response, error);
  }
}

export async function deleteDecisionRouteHandler(
  request: DecisionRouteRequest,
  response: DecisionRouteResponse,
  dependencies: DecisionRouteDependencies,
): Promise<void> {
  try {
    const tenantContext = requireTenantContext(request);
    const decisionId = getDecisionIdFromParams(request);
    await dependencies.decisionService.deleteDecision(tenantContext, decisionId);

    response.status(200).json({
      data: {
        deleted: true,
        decisionId,
      },
    });
  } catch (error) {
    sendErrorResponse(response, error);
  }
}

export async function getDecisionChecklistRouteHandler(
  request: DecisionRouteRequest,
  response: DecisionRouteResponse,
  dependencies: DecisionRouteDependencies,
): Promise<void> {
  try {
    const tenantContext = requireTenantContext(request);
    const decisionId = getDecisionIdFromParams(request);
    const checklist = await dependencies.decisionService.evaluateChecklist(tenantContext, decisionId);

    response.status(200).json({
      data: {
        checklist,
      },
    });
  } catch (error) {
    sendErrorResponse(response, error);
  }
}

export async function transitionDecisionRouteHandler(
  request: DecisionRouteRequest,
  response: DecisionRouteResponse,
  dependencies: DecisionRouteDependencies,
): Promise<void> {
  try {
    const tenantContext = requireTenantContext(request);
    const decisionId = getDecisionIdFromParams(request);
    const { decision, checklist } = await dependencies.decisionService.transitionDecision(
      tenantContext,
      decisionId,
      (request.body as { targetStatus?: unknown } | undefined)?.targetStatus,
    );

    response.status(200).json({
      data: {
        decision,
        checklist,
      },
    });
  } catch (error) {
    sendErrorResponse(response, error);
  }
}

export async function listDecisionCommentsRouteHandler(
  request: DecisionRouteRequest,
  response: DecisionRouteResponse,
  dependencies: DecisionRouteDependencies,
): Promise<void> {
  try {
    const tenantContext = requireTenantContext(request);
    const decisionId = getDecisionIdFromParams(request);
    const comments = await dependencies.decisionService.listComments(tenantContext, decisionId);

    response.status(200).json({
      data: {
        comments,
      },
    });
  } catch (error) {
    sendErrorResponse(response, error);
  }
}

export async function createDecisionCommentRouteHandler(
  request: DecisionRouteRequest,
  response: DecisionRouteResponse,
  dependencies: DecisionRouteDependencies,
): Promise<void> {
  try {
    const tenantContext = requireTenantContext(request);
    const decisionId = getDecisionIdFromParams(request);
    const comment = await dependencies.decisionService.addComment(tenantContext, decisionId, request.body);

    response.status(201).json({
      data: {
        comment,
      },
    });
  } catch (error) {
    sendErrorResponse(response, error);
  }
}
