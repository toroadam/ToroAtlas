import {
  resolveTenantContext,
  type ClerkSessionClaims,
  type TenantContext,
  TenantContextError,
} from "../auth/clerk.js";

export type TenantRequest = {
  auth?: {
    sessionClaims?: ClerkSessionClaims;
  };
  tenantContext?: TenantContext;
};

export type TenantResponse = {
  status(code: number): TenantResponse;
  json(payload: unknown): void;
};

export type NextFunction = () => void;

export function resolveRequestTenantContext(request: TenantRequest): TenantContext {
  return resolveTenantContext(request.auth?.sessionClaims);
}

export function tenantContextMiddleware(
  request: TenantRequest,
  response: TenantResponse,
  next: NextFunction,
): void {
  try {
    request.tenantContext = resolveRequestTenantContext(request);
    next();
  } catch (error) {
    if (error instanceof TenantContextError) {
      response
        .status(error.code === "UNAUTHENTICATED" ? 401 : 403)
        .json({
          error: error.code,
          message: error.message,
        });
      return;
    }

    response.status(500).json({
      error: "TENANT_CONTEXT_FAILURE",
      message: "Failed to resolve tenant context from authenticated request.",
    });
  }
}

export function requireTenantContext(request: TenantRequest): TenantContext {
  if (!request.tenantContext) {
    throw new TenantContextError(
      "INVALID_CONTEXT",
      "Tenant context has not been resolved for this request.",
    );
  }

  return request.tenantContext;
}
