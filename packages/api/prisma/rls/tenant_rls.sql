-- Tenant isolation policies for ToroAtlas core records.
-- This file is intentionally separate from prisma/migrations to keep rollout non-destructive.

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS projects_tenant_select ON projects;
CREATE POLICY projects_tenant_select ON projects
  FOR SELECT
  USING (
    organization_id = current_setting('app.organization_id', true)
    AND (workspace_id IS NULL OR workspace_id = current_setting('app.workspace_id', true))
    AND (product_id IS NULL OR product_id = current_setting('app.product_id', true))
  );

DROP POLICY IF EXISTS projects_tenant_insert ON projects;
CREATE POLICY projects_tenant_insert ON projects
  FOR INSERT
  WITH CHECK (
    organization_id = current_setting('app.organization_id', true)
    AND (workspace_id IS NULL OR workspace_id = current_setting('app.workspace_id', true))
    AND (product_id IS NULL OR product_id = current_setting('app.product_id', true))
  );

DROP POLICY IF EXISTS projects_tenant_update ON projects;
CREATE POLICY projects_tenant_update ON projects
  FOR UPDATE
  USING (
    organization_id = current_setting('app.organization_id', true)
    AND (workspace_id IS NULL OR workspace_id = current_setting('app.workspace_id', true))
    AND (product_id IS NULL OR product_id = current_setting('app.product_id', true))
  )
  WITH CHECK (
    organization_id = current_setting('app.organization_id', true)
    AND (workspace_id IS NULL OR workspace_id = current_setting('app.workspace_id', true))
    AND (product_id IS NULL OR product_id = current_setting('app.product_id', true))
  );

DROP POLICY IF EXISTS projects_tenant_delete ON projects;
CREATE POLICY projects_tenant_delete ON projects
  FOR DELETE
  USING (
    organization_id = current_setting('app.organization_id', true)
    AND (workspace_id IS NULL OR workspace_id = current_setting('app.workspace_id', true))
    AND (product_id IS NULL OR product_id = current_setting('app.product_id', true))
  );

ALTER TABLE decision_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_records FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS decision_records_tenant_select ON decision_records;
CREATE POLICY decision_records_tenant_select ON decision_records
  FOR SELECT
  USING (
    organization_id = current_setting('app.organization_id', true)
    AND (workspace_id IS NULL OR workspace_id = current_setting('app.workspace_id', true))
    AND (product_id IS NULL OR product_id = current_setting('app.product_id', true))
  );

DROP POLICY IF EXISTS decision_records_tenant_insert ON decision_records;
CREATE POLICY decision_records_tenant_insert ON decision_records
  FOR INSERT
  WITH CHECK (
    organization_id = current_setting('app.organization_id', true)
    AND (workspace_id IS NULL OR workspace_id = current_setting('app.workspace_id', true))
    AND (product_id IS NULL OR product_id = current_setting('app.product_id', true))
  );

DROP POLICY IF EXISTS decision_records_tenant_update ON decision_records;
CREATE POLICY decision_records_tenant_update ON decision_records
  FOR UPDATE
  USING (
    organization_id = current_setting('app.organization_id', true)
    AND (workspace_id IS NULL OR workspace_id = current_setting('app.workspace_id', true))
    AND (product_id IS NULL OR product_id = current_setting('app.product_id', true))
  )
  WITH CHECK (
    organization_id = current_setting('app.organization_id', true)
    AND (workspace_id IS NULL OR workspace_id = current_setting('app.workspace_id', true))
    AND (product_id IS NULL OR product_id = current_setting('app.product_id', true))
  );

DROP POLICY IF EXISTS decision_records_tenant_delete ON decision_records;
CREATE POLICY decision_records_tenant_delete ON decision_records
  FOR DELETE
  USING (
    organization_id = current_setting('app.organization_id', true)
    AND (workspace_id IS NULL OR workspace_id = current_setting('app.workspace_id', true))
    AND (product_id IS NULL OR product_id = current_setting('app.product_id', true))
  );
