import { TenantContextError, type TenantContext } from "../auth/clerk.js";

type RequiredScope = {
  organizationId?: string;
  workspaceId?: string;
  productId?: string;
};

export function assertTenantAccess(
  tenantContext: TenantContext,
  requiredScope: RequiredScope,
): void {
  if (
    requiredScope.organizationId &&
    tenantContext.organizationId !== requiredScope.organizationId
  ) {
    throw new TenantContextError(
      "INVALID_CONTEXT",
      "Organization scope mismatch for requested resource.",
    );
  }

  if (requiredScope.workspaceId && tenantContext.workspaceId !== requiredScope.workspaceId) {
    throw new TenantContextError(
      "INVALID_CONTEXT",
      "Workspace scope mismatch for requested resource.",
    );
  }

  if (requiredScope.productId && tenantContext.productId !== requiredScope.productId) {
    throw new TenantContextError(
      "INVALID_CONTEXT",
      "Product scope mismatch for requested resource.",
    );
  }
}
