import type { TenantContext } from "../auth/clerk.js";
import { runTenantScopedTransaction, type PrismaClientLike, type PrismaTransactionLike } from "../db/prisma.js";

type TenantScopeRow = {
  userId: string | null;
  organizationId: string | null;
  workspaceId: string | null;
  productId: string | null;
};

export type TenantScopeSnapshot = {
  userId: string;
  organizationId: string;
  workspaceId: string | null;
  productId: string | null;
};

export type TenantScopeTransactionClient = PrismaTransactionLike & {
  $queryRawUnsafe<TResult>(statement: string): Promise<TResult>;
};

export type TenantScopePrismaClient = PrismaClientLike & {
  $transaction<TResult>(
    transactionFn: (transactionClient: TenantScopeTransactionClient) => Promise<TResult>,
  ): Promise<TResult>;
};

const TENANT_SCOPE_SQL = `
SELECT
  current_setting('app.current_user_id', true) AS "userId",
  current_setting('app.organization_id', true) AS "organizationId",
  nullif(current_setting('app.workspace_id', true), '') AS "workspaceId",
  nullif(current_setting('app.product_id', true), '') AS "productId";
`;

export async function readTenantScopeSnapshot(
  prismaClient: TenantScopePrismaClient,
  tenantContext: TenantContext,
): Promise<TenantScopeSnapshot> {
  return runTenantScopedTransaction(prismaClient, tenantContext, async (transactionClient) => {
    const queryClient = transactionClient as TenantScopeTransactionClient;
    const rows = await queryClient.$queryRawUnsafe<TenantScopeRow[]>(TENANT_SCOPE_SQL);
    const row = rows[0];

    if (!row?.userId || !row.organizationId) {
      throw new Error("Tenant session context was not applied before tenant-scoped query execution.");
    }

    return {
      userId: row.userId,
      organizationId: row.organizationId,
      workspaceId: row.workspaceId,
      productId: row.productId,
    };
  });
}
