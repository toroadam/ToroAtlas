import type { TenantContext } from "../auth/clerk.js";

export const TENANT_TABLES = ["projects", "decision_records"] as const;

const ORG_CLAUSE = `organization_id = current_setting('app.organization_id', true)`;
const WORKSPACE_CLAUSE = `(workspace_id IS NULL OR workspace_id = current_setting('app.workspace_id', true))`;
const PRODUCT_CLAUSE = `(product_id IS NULL OR product_id = current_setting('app.product_id', true))`;

export function tenantPredicateSql(): string {
  return [ORG_CLAUSE, WORKSPACE_CLAUSE, PRODUCT_CLAUSE].join(" AND ");
}

export function buildTenantRlsSql(): string {
  const predicate = tenantPredicateSql();

  return TENANT_TABLES.map((tableName) => {
    return [
      `ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY;`,
      `ALTER TABLE ${tableName} FORCE ROW LEVEL SECURITY;`,
      `DROP POLICY IF EXISTS ${tableName}_tenant_select ON ${tableName};`,
      `CREATE POLICY ${tableName}_tenant_select ON ${tableName} FOR SELECT USING (${predicate});`,
      `DROP POLICY IF EXISTS ${tableName}_tenant_insert ON ${tableName};`,
      `CREATE POLICY ${tableName}_tenant_insert ON ${tableName} FOR INSERT WITH CHECK (${predicate});`,
      `DROP POLICY IF EXISTS ${tableName}_tenant_update ON ${tableName};`,
      `CREATE POLICY ${tableName}_tenant_update ON ${tableName} FOR UPDATE USING (${predicate}) WITH CHECK (${predicate});`,
      `DROP POLICY IF EXISTS ${tableName}_tenant_delete ON ${tableName};`,
      `CREATE POLICY ${tableName}_tenant_delete ON ${tableName} FOR DELETE USING (${predicate});`,
    ].join("\n");
  }).join("\n\n");
}

export type TenantRow = {
  organizationId: string;
  workspaceId?: string | null;
  productId?: string | null;
};

export function canAccessTenantRow(
  row: TenantRow,
  tenantContext: TenantContext,
): boolean {
  if (row.organizationId !== tenantContext.organizationId) {
    return false;
  }

  if (row.workspaceId && tenantContext.workspaceId && row.workspaceId !== tenantContext.workspaceId) {
    return false;
  }

  if (row.productId && tenantContext.productId && row.productId !== tenantContext.productId) {
    return false;
  }

  return true;
}
