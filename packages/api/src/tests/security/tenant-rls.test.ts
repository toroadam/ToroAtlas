import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";

import { canAccessTenantRow, TENANT_TABLES, tenantPredicateSql } from "../../db/rlsPolicies.js";
import { applyTenantSessionContext, buildTenantSessionStatements } from "../../db/sessionContext.js";
import type { TenantContext } from "../../auth/clerk.js";
import { runTenantScopedTransaction, type PrismaClientLike } from "../../db/prisma.js";

const tenantAContext: TenantContext = {
  userId: "user_a",
  organizationId: "org_a",
  workspaceId: "ws_a",
  productId: "prod_a",
};

const tenantBContext: TenantContext = {
  userId: "user_b",
  organizationId: "org_b",
  workspaceId: "ws_b",
  productId: "prod_b",
};

const postgresRlsTestDatabaseUrl =
  process.env.POSTGRES_RLS_TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const isCi = process.env.CI === "true";

test("buildTenantSessionStatements sets tenant-bound PostgreSQL session vars", () => {
  const statements = buildTenantSessionStatements(tenantAContext);

  assert.equal(statements.length, 4);
  assert.match(statements[0], /SET LOCAL app\.current_user_id/);
  assert.match(statements[1], /SET LOCAL app\.organization_id/);
  assert.match(statements[2], /SET LOCAL app\.workspace_id/);
  assert.match(statements[3], /SET LOCAL app\.product_id/);
});

test("buildTenantSessionStatements resets optional tenant vars when workspace/product are absent", () => {
  const statements = buildTenantSessionStatements({
    userId: "user_only_org",
    organizationId: "org_only",
  });

  assert.equal(statements.length, 4);
  assert.match(statements[0], /SET LOCAL app\.current_user_id/);
  assert.match(statements[1], /SET LOCAL app\.organization_id/);
  assert.equal(statements[2], "RESET LOCAL app.workspace_id;");
  assert.equal(statements[3], "RESET LOCAL app.product_id;");
});

test("tenant policy SQL includes full CRUD policy coverage for tenant tables", () => {
  const sqlPath = resolve(process.cwd(), "prisma/rls/tenant_rls.sql");
  const sql = readFileSync(sqlPath, "utf-8");

  assert.match(tenantPredicateSql(), /organization_id = current_setting\('app\.organization_id', true\)/);

  for (const table of TENANT_TABLES) {
    assert.match(sql, new RegExp(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`));
    assert.match(sql, new RegExp(`CREATE POLICY ${table}_tenant_select ON ${table}`));
    assert.match(sql, new RegExp(`CREATE POLICY ${table}_tenant_insert ON ${table}`));
    assert.match(sql, new RegExp(`CREATE POLICY ${table}_tenant_update ON ${table}`));
    assert.match(sql, new RegExp(`CREATE POLICY ${table}_tenant_delete ON ${table}`));
  }
});

test("cross-tenant read and write checks are denied by tenant scope evaluator", () => {
  const tenantARow = {
    organizationId: "org_a",
    workspaceId: "ws_a",
    productId: "prod_a",
  };
  const tenantBRow = {
    organizationId: "org_b",
    workspaceId: "ws_b",
    productId: "prod_b",
  };

  assert.equal(canAccessTenantRow(tenantARow, tenantAContext), true);
  assert.equal(canAccessTenantRow(tenantBRow, tenantBContext), true);
  assert.equal(canAccessTenantRow(tenantBRow, tenantAContext), false);
  assert.equal(canAccessTenantRow(tenantARow, tenantBContext), false);
});

async function withPgClient<T>(
  run: (client: {
    query: (sql: string, params?: unknown[]) => Promise<{ rowCount: number; rows: unknown[] }>;
    end: () => Promise<void>;
  }) => Promise<T>,
): Promise<T> {
  if (!postgresRlsTestDatabaseUrl) {
    throw new Error(
      "Set POSTGRES_RLS_TEST_DATABASE_URL (or DATABASE_URL) to run PostgreSQL RLS enforcement tests.",
    );
  }

  const { Client } = await import("pg");
  const client = new Client({
    connectionString: postgresRlsTestDatabaseUrl,
  });
  await client.connect();

  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

function quotedIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

async function runWithTenantTx<T>(
  client: { query: (sql: string, params?: unknown[]) => Promise<{ rowCount: number; rows: unknown[] }> },
  schemaName: string,
  tenantContext: TenantContext,
  run: () => Promise<T>,
): Promise<T> {
  await client.query("BEGIN");
  try {
    await client.query(`SET LOCAL search_path TO ${quotedIdentifier(schemaName)}, public;`);
    await applyTenantSessionContext((statement) => client.query(statement), tenantContext);
    const result = await run();
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

test(
  "runTenantScopedTransaction applies tenant session settings before tenant-scoped query execution",
  async () => {
    const callOrder: string[] = [];
    const statements: string[] = [];

    const prismaClient: PrismaClientLike = {
      async $transaction(transactionFn) {
        callOrder.push("transaction:start");
        const result = await transactionFn({
          async $executeRawUnsafe(statement: string) {
            statements.push(statement);
            callOrder.push(`set:${statement}`);
            return null;
          },
        });
        callOrder.push("transaction:end");
        return result;
      },
    };

    const runResult = await runTenantScopedTransaction(
      prismaClient,
      tenantAContext,
      async (transactionClient) => {
        await transactionClient.$executeRawUnsafe("SELECT 1;");
        callOrder.push("query:tenant-scoped");
        return "done";
      },
    );

    assert.equal(runResult, "done");
    assert.equal(statements.length, 5);
    assert.match(statements[0], /SET LOCAL app\.current_user_id/);
    assert.match(statements[1], /SET LOCAL app\.organization_id/);
    assert.match(statements[2], /SET LOCAL app\.workspace_id/);
    assert.match(statements[3], /SET LOCAL app\.product_id/);
    assert.equal(statements[4], "SELECT 1;");
    assert.ok(callOrder.indexOf("set:SELECT 1;") > callOrder.indexOf("set:SET LOCAL app.product_id = 'prod_a';"));
  },
);

test(
  "PostgreSQL RLS blocks cross-tenant read/write when app tenant session variables are set",
  async (testContext) => {
    if (!postgresRlsTestDatabaseUrl) {
      if (isCi) {
        assert.fail(
          "DATABASE_URL (or POSTGRES_RLS_TEST_DATABASE_URL) must be configured in CI for RLS enforcement tests.",
        );
      }
      testContext.skip(
        "Set POSTGRES_RLS_TEST_DATABASE_URL (or DATABASE_URL) to run PostgreSQL RLS enforcement tests.",
      );
      return;
    }

    await withPgClient(async (client) => {
      const schemaName = `tenant_rls_${randomUUID().replaceAll("-", "")}`;
      const sqlPath = resolve(process.cwd(), "prisma/rls/tenant_rls.sql");
      const sql = readFileSync(sqlPath, "utf-8");

      await client.query(`CREATE SCHEMA ${quotedIdentifier(schemaName)};`);
      await client.query(`SET search_path TO ${quotedIdentifier(schemaName)}, public;`);
      await client.query(`
        CREATE TABLE projects (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          workspace_id TEXT,
          product_id TEXT,
          name TEXT NOT NULL
        );
      `);
      await client.query(`
        CREATE TABLE decision_records (
          id TEXT PRIMARY KEY,
          organization_id TEXT NOT NULL,
          workspace_id TEXT,
          product_id TEXT,
          title TEXT NOT NULL,
          rationale TEXT NOT NULL
        );
      `);
      await client.query(sql);

      await runWithTenantTx(client, schemaName, tenantAContext, async () => {
        await client.query(
          "INSERT INTO projects (id, organization_id, workspace_id, product_id, name) VALUES ($1, $2, $3, $4, $5);",
          ["project_a", "org_a", "ws_a", "prod_a", "Tenant A Project"],
        );
      });

      await runWithTenantTx(client, schemaName, tenantAContext, async () => {
        const ownRows = await client.query("SELECT id FROM projects;");
        assert.equal(ownRows.rowCount, 1);
      });

      await runWithTenantTx(client, schemaName, tenantBContext, async () => {
        const crossTenantRows = await client.query("SELECT id FROM projects;");
        assert.equal(crossTenantRows.rowCount, 0);

        const updateAttempt = await client.query(
          "UPDATE projects SET name = 'attacker_update' WHERE id = 'project_a';",
        );
        assert.equal(updateAttempt.rowCount, 0);
      });

      await assert.rejects(
        () =>
          runWithTenantTx(client, schemaName, tenantBContext, async () => {
            await client.query(
              "INSERT INTO projects (id, organization_id, workspace_id, product_id, name) VALUES ($1, $2, $3, $4, $5);",
              ["project_b", "org_a", "ws_a", "prod_a", "Cross Tenant Insert"],
            );
          }),
        /row-level security policy|permission denied|violates row-level security/i,
      );

      await client.query(`DROP SCHEMA ${quotedIdentifier(schemaName)} CASCADE;`);
    });
  },
);
