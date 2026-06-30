export type ClerkTenantClaims = {
  orgId?: string | null;
  orgSlug?: string | null;
  orgRole?: string | null;
  workspaceId?: string | null;
  productId?: string | null;
};

export type TenantHeaders = Record<string, string>;

export function buildTenantHeadersFromClaims(claims: ClerkTenantClaims): TenantHeaders {
  const headers: TenantHeaders = {};

  if (claims.orgId) {
    headers["x-clerk-org-id"] = claims.orgId;
  }
  if (claims.orgSlug) {
    headers["x-clerk-org-slug"] = claims.orgSlug;
  }
  if (claims.orgRole) {
    headers["x-clerk-org-role"] = claims.orgRole;
  }
  if (claims.workspaceId) {
    headers["x-tenant-workspace-id"] = claims.workspaceId;
  }
  if (claims.productId) {
    headers["x-tenant-product-id"] = claims.productId;
  }

  return headers;
}
