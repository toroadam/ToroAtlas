import type { TenantContext } from "../auth/clerk.js";
import { applyTenantSessionContext } from "./sessionContext.js";

export type TenantScopedRecord = {
  organizationId: string;
  workspaceId?: string | null;
  productId?: string | null;
};

export type TenantScope = {
  organizationId: string;
  workspaceId?: string | null;
  productId?: string | null;
};

/**
 * Helper predicate for application-layer query guards.
 * Database RLS remains the authoritative isolation control.
 */
export function matchesTenantScope(
  record: TenantScopedRecord,
  scope: TenantScope,
): boolean {
  if (record.organizationId !== scope.organizationId) {
    return false;
  }

  if (scope.workspaceId && record.workspaceId && scope.workspaceId !== record.workspaceId) {
    return false;
  }

  if (scope.productId && record.productId && scope.productId !== record.productId) {
    return false;
  }

  return true;
}

export type PrismaTransactionLike = {
  $executeRawUnsafe(statement: string): Promise<unknown>;
};

export type PrismaClientLike = {
  $transaction<TResult>(
    transactionFn: (transactionClient: PrismaTransactionLike) => Promise<TResult>,
  ): Promise<TResult>;
};

export async function setTenantDbSessionContext(
  transactionClient: PrismaTransactionLike,
  tenantContext: TenantContext,
): Promise<void> {
  await applyTenantSessionContext(
    (statement) => transactionClient.$executeRawUnsafe(statement),
    tenantContext,
  );
}

export async function runTenantScopedTransaction<TResult>(
  prismaClient: PrismaClientLike,
  tenantContext: TenantContext,
  run: (transactionClient: PrismaTransactionLike) => Promise<TResult>,
): Promise<TResult> {
  return prismaClient.$transaction(async (transactionClient) => {
    await setTenantDbSessionContext(transactionClient, tenantContext);
    return run(transactionClient);
  });
}
