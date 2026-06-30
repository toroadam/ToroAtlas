import type { TenantContext } from "../auth/clerk.js";

export type SqlExecutor = (statement: string) => Promise<unknown> | unknown;
export type TenantScopedWork<TResult> = () => Promise<TResult>;

function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export function buildTenantSessionStatements(tenantContext: TenantContext): string[] {
  const statements = [
    `SET LOCAL app.current_user_id = ${sqlLiteral(tenantContext.userId)};`,
    `SET LOCAL app.organization_id = ${sqlLiteral(tenantContext.organizationId)};`,
  ];

  if (tenantContext.workspaceId) {
    statements.push(`SET LOCAL app.workspace_id = ${sqlLiteral(tenantContext.workspaceId)};`);
  } else {
    statements.push("RESET LOCAL app.workspace_id;");
  }

  if (tenantContext.productId) {
    statements.push(`SET LOCAL app.product_id = ${sqlLiteral(tenantContext.productId)};`);
  } else {
    statements.push("RESET LOCAL app.product_id;");
  }

  return statements;
}

export async function applyTenantSessionContext(
  execute: SqlExecutor,
  tenantContext: TenantContext,
): Promise<void> {
  const statements = buildTenantSessionStatements(tenantContext);
  for (const statement of statements) {
    await execute(statement);
  }
}

export async function runWithTenantSessionContext<TResult>(
  execute: SqlExecutor,
  tenantContext: TenantContext,
  work: TenantScopedWork<TResult>,
): Promise<TResult> {
  await applyTenantSessionContext(execute, tenantContext);
  return work();
}
