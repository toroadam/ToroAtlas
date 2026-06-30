import type { TenantContext } from "../../auth/clerk.js";
import { assertTenantAccess } from "../../middleware/authorization.js";
import type {
  ProductDecision,
  ProductDecisionAuditEvent,
  ProductDecisionComment,
  ProductDecisionCreateInput,
  ProductDecisionScope,
  ProductDecisionUpdateInput,
} from "./decision.types.js";
import { DecisionDomainError } from "./decision.errors.js";

export type ProductDecisionListFilters = {
  lifecycleStatus?: ProductDecision["lifecycleStatus"];
};

export type ProductDecisionRepository = {
  create(scope: ProductDecisionScope, actorUserId: string, input: ProductDecisionCreateInput): Promise<ProductDecision>;
  list(scope: ProductDecisionScope, filters?: ProductDecisionListFilters): Promise<ProductDecision[]>;
  findById(scope: ProductDecisionScope, decisionId: string): Promise<ProductDecision | null>;
  update(
    scope: ProductDecisionScope,
    decisionId: string,
    actorUserId: string,
    input: ProductDecisionUpdateInput & { lifecycleStatus?: ProductDecision["lifecycleStatus"] },
  ): Promise<ProductDecision | null>;
  remove(scope: ProductDecisionScope, decisionId: string): Promise<boolean>;
  addComment(
    scope: ProductDecisionScope,
    decisionId: string,
    actorUserId: string,
    body: string,
  ): Promise<ProductDecisionComment | null>;
  listComments(scope: ProductDecisionScope, decisionId: string): Promise<ProductDecisionComment[]>;
  appendAuditEvent(event: Omit<ProductDecisionAuditEvent, "id" | "happenedAt">): Promise<ProductDecisionAuditEvent>;
};

export function scopeFromTenantContext(tenantContext: TenantContext): ProductDecisionScope {
  return {
    organizationId: tenantContext.organizationId,
    workspaceId: tenantContext.workspaceId ?? null,
    productId: tenantContext.productId ?? null,
  };
}

export function assertDecisionScopeAccess(
  tenantContext: TenantContext,
  decisionLike: {
    organizationId: string;
    workspaceId?: string | null;
    productId?: string | null;
  },
): void {
  assertTenantAccess(tenantContext, {
    organizationId: decisionLike.organizationId,
    workspaceId: decisionLike.workspaceId ?? undefined,
    productId: decisionLike.productId ?? undefined,
  });
}

type IdGenerator = () => string;
type NowProvider = () => string;

type InMemoryRepositoryOptions = {
  idGenerator?: IdGenerator;
  nowProvider?: NowProvider;
};

export class InMemoryProductDecisionRepository implements ProductDecisionRepository {
  private readonly decisions = new Map<string, ProductDecision>();
  private readonly comments = new Map<string, ProductDecisionComment[]>();
  private readonly auditEvents: ProductDecisionAuditEvent[] = [];
  private readonly idGenerator: IdGenerator;
  private readonly nowProvider: NowProvider;

  public constructor(options: InMemoryRepositoryOptions = {}) {
    this.idGenerator = options.idGenerator ?? (() => crypto.randomUUID());
    this.nowProvider = options.nowProvider ?? (() => new Date().toISOString());
  }

  public async create(
    scope: ProductDecisionScope,
    actorUserId: string,
    input: ProductDecisionCreateInput,
  ): Promise<ProductDecision> {
    const id = this.idGenerator();
    const now = this.nowProvider();
    const created: ProductDecision = {
      id,
      organizationId: scope.organizationId,
      workspaceId: input.workspaceId ?? scope.workspaceId ?? null,
      productId: input.productId ?? scope.productId ?? null,
      title: input.title,
      framing: {
        ...input.framing,
        optionsConsidered: [...input.framing.optionsConsidered],
      },
      lifecycleStatus: "framing",
      createdByUserId: actorUserId,
      updatedByUserId: actorUserId,
      createdAt: now,
      updatedAt: now,
      transitionedAt: null,
    };
    this.decisions.set(created.id, created);
    return structuredClone(created);
  }

  public async list(
    scope: ProductDecisionScope,
    filters: ProductDecisionListFilters = {},
  ): Promise<ProductDecision[]> {
    return [...this.decisions.values()]
      .filter((decision) => this.inScope(decision, scope))
      .filter((decision) => !filters.lifecycleStatus || decision.lifecycleStatus === filters.lifecycleStatus)
      .map((decision) => structuredClone(decision));
  }

  public async findById(scope: ProductDecisionScope, decisionId: string): Promise<ProductDecision | null> {
    const decision = this.decisions.get(decisionId);
    if (!decision || !this.inScope(decision, scope)) {
      return null;
    }
    return structuredClone(decision);
  }

  public async update(
    scope: ProductDecisionScope,
    decisionId: string,
    actorUserId: string,
    input: ProductDecisionUpdateInput & { lifecycleStatus?: ProductDecision["lifecycleStatus"] },
  ): Promise<ProductDecision | null> {
    const existing = this.decisions.get(decisionId);
    if (!existing || !this.inScope(existing, scope)) {
      return null;
    }

    const next: ProductDecision = {
      ...existing,
      ...("title" in input ? { title: input.title ?? existing.title } : {}),
      ...("workspaceId" in input ? { workspaceId: input.workspaceId ?? null } : {}),
      ...("productId" in input ? { productId: input.productId ?? null } : {}),
      lifecycleStatus: input.lifecycleStatus ?? existing.lifecycleStatus,
      framing: {
        ...existing.framing,
        ...(input.framing ?? {}),
      },
      transitionedAt:
        input.lifecycleStatus && input.lifecycleStatus !== existing.lifecycleStatus
          ? this.nowProvider()
          : existing.transitionedAt,
      updatedByUserId: actorUserId,
      updatedAt: this.nowProvider(),
    };
    this.decisions.set(existing.id, next);
    return structuredClone(next);
  }

  public async remove(scope: ProductDecisionScope, decisionId: string): Promise<boolean> {
    const existing = this.decisions.get(decisionId);
    if (!existing || !this.inScope(existing, scope)) {
      return false;
    }

    this.decisions.delete(decisionId);
    this.comments.delete(decisionId);
    return true;
  }

  public async addComment(
    scope: ProductDecisionScope,
    decisionId: string,
    actorUserId: string,
    body: string,
  ): Promise<ProductDecisionComment | null> {
    const decision = this.decisions.get(decisionId);
    if (!decision || !this.inScope(decision, scope)) {
      return null;
    }

    const comment: ProductDecisionComment = {
      id: this.idGenerator(),
      decisionId,
      organizationId: decision.organizationId,
      workspaceId: decision.workspaceId,
      productId: decision.productId,
      body,
      createdByUserId: actorUserId,
      createdAt: this.nowProvider(),
    };
    const current = this.comments.get(decisionId) ?? [];
    this.comments.set(decisionId, [...current, comment]);
    return structuredClone(comment);
  }

  public async listComments(scope: ProductDecisionScope, decisionId: string): Promise<ProductDecisionComment[]> {
    const decision = this.decisions.get(decisionId);
    if (!decision || !this.inScope(decision, scope)) {
      return [];
    }

    return (this.comments.get(decisionId) ?? []).map((comment) => structuredClone(comment));
  }

  public async appendAuditEvent(
    event: Omit<ProductDecisionAuditEvent, "id" | "happenedAt">,
  ): Promise<ProductDecisionAuditEvent> {
    const created: ProductDecisionAuditEvent = {
      ...event,
      id: this.idGenerator(),
      happenedAt: this.nowProvider(),
    };
    this.auditEvents.push(created);
    return structuredClone(created);
  }

  public getAuditEvents(): ProductDecisionAuditEvent[] {
    return this.auditEvents.map((event) => structuredClone(event));
  }

  private inScope(decision: ProductDecision, scope: ProductDecisionScope): boolean {
    if (decision.organizationId !== scope.organizationId) {
      return false;
    }

    if (scope.workspaceId && decision.workspaceId !== scope.workspaceId) {
      return false;
    }

    if (scope.productId && decision.productId !== scope.productId) {
      return false;
    }

    return true;
  }
}

export function requireDecisionForScope<TDecision>(
  decision: TDecision | null,
  decisionId: string,
): TDecision {
  if (!decision) {
    throw new DecisionDomainError(
      "DECISION_NOT_FOUND",
      `Decision '${decisionId}' was not found in the authorized tenant scope.`,
      404,
    );
  }

  return decision;
}
