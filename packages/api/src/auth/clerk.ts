export type ClerkSessionClaims = {
  sub?: string;
  sid?: string;
  org_id?: string;
  org_slug?: string;
  org_role?: string;
  workspace_id?: string;
  product_id?: string;
};

export type TenantContext = {
  userId: string;
  sessionId?: string;
  organizationId: string;
  organizationSlug?: string;
  organizationRole?: string;
  workspaceId?: string;
  productId?: string;
};

export class TenantContextError extends Error {
  public readonly code: "UNAUTHENTICATED" | "MISSING_ORGANIZATION" | "INVALID_CONTEXT";

  public constructor(
    code: TenantContextError["code"],
    message: string,
  ) {
    super(message);
    this.name = "TenantContextError";
    this.code = code;
  }
}

export function mapClerkClaimsToTenantContext(
  claims: ClerkSessionClaims | null | undefined,
): TenantContext {
  if (!claims?.sub || !claims.sid) {
    throw new TenantContextError(
      "UNAUTHENTICATED",
      "Verified Clerk session claims are required for tenant-scoped access.",
    );
  }

  if (!claims.org_id) {
    throw new TenantContextError(
      "MISSING_ORGANIZATION",
      "An active Clerk organization is required for tenant-scoped access.",
    );
  }

  return {
    userId: claims.sub,
    sessionId: claims.sid,
    organizationId: claims.org_id,
    organizationSlug: claims.org_slug,
    organizationRole: claims.org_role,
    workspaceId: claims.workspace_id,
    productId: claims.product_id,
  };
}

export function resolveTenantContext(claims?: ClerkSessionClaims | null): TenantContext {
  return mapClerkClaimsToTenantContext(claims);
}
