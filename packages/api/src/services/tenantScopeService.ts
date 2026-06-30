import type { TenantContext } from "../auth/clerk.js";
import {
  readTenantScopeSnapshot,
  type TenantScopePrismaClient,
  type TenantScopeSnapshot,
} from "../repositories/tenantScopeRepository.js";

export async function getTenantScopeSnapshot(
  prismaClient: TenantScopePrismaClient,
  tenantContext: TenantContext,
): Promise<TenantScopeSnapshot> {
  return readTenantScopeSnapshot(prismaClient, tenantContext);
}
