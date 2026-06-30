import { TenantContextError } from "../auth/clerk.js";
import {
  requireTenantContext,
  type TenantRequest,
  type TenantResponse,
} from "../middleware/tenantContext.js";
import { getTenantScopeSnapshot } from "../services/tenantScopeService.js";
import type { TenantScopePrismaClient } from "../repositories/tenantScopeRepository.js";

export type TenantScopeRouteDependencies = {
  prismaClient: TenantScopePrismaClient;
};

export async function getTenantScopeRouteHandler(
  request: TenantRequest,
  response: TenantResponse,
  dependencies: TenantScopeRouteDependencies,
): Promise<void> {
  try {
    const tenantContext = requireTenantContext(request);
    const tenantScope = await getTenantScopeSnapshot(dependencies.prismaClient, tenantContext);

    response.status(200).json({
      tenantScope,
    });
  } catch (error) {
    if (error instanceof TenantContextError) {
      response.status(403).json({
        error: error.code,
        message: error.message,
      });
      return;
    }

    response.status(500).json({
      error: "TENANT_SCOPE_ROUTE_FAILURE",
      message: "Failed to execute tenant-scoped database access.",
    });
  }
}
