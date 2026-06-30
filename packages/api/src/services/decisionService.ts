import { TenantContextError, type TenantContext } from "../auth/clerk.js";
import { assertTenantAccess } from "../middleware/authorization.js";
import {
  DecisionDomainError,
  requireDecisionForScope,
  isLifecycleStatus,
  scopeFromTenantContext,
  validateDecisionCreateInput,
  validateDecisionUpdateInput,
  type ProductDecision,
  type ProductDecisionChecklistEvaluation,
  type ProductDecisionComment,
  type ProductDecisionCreateInput,
  type ProductDecisionListFilters,
  type ProductDecisionLifecycleStatus,
  type ProductDecisionRepository,
  type ProductDecisionScope,
  type ProductDecisionUpdateInput,
} from "../modules/decisions/index.js";
import {
  assertDecisionTransitionAllowed,
  evaluateDecisionChecklist,
  validateCommentBody,
} from "./decisionWorkflow.js";
import { createLogger, type Logger } from "../observability/logger.js";
import {
  createDecisionAuditService,
  type DecisionAuditService,
} from "./audit/auditService.js";

export type ListDecisionsInput = ProductDecisionListFilters & {
  workspaceId?: string | null;
  productId?: string | null;
};

export type DecisionService = {
  createDecision(tenantContext: TenantContext, input: unknown): Promise<ProductDecision>;
  listDecisions(tenantContext: TenantContext, input?: ListDecisionsInput): Promise<ProductDecision[]>;
  getDecision(tenantContext: TenantContext, decisionId: string): Promise<ProductDecision>;
  updateDecision(tenantContext: TenantContext, decisionId: string, input: unknown): Promise<ProductDecision>;
  deleteDecision(tenantContext: TenantContext, decisionId: string): Promise<void>;
  evaluateChecklist(
    tenantContext: TenantContext,
    decisionId: string,
  ): Promise<ProductDecisionChecklistEvaluation>;
  transitionDecision(
    tenantContext: TenantContext,
    decisionId: string,
    targetStatus: unknown,
  ): Promise<{ decision: ProductDecision; checklist: ProductDecisionChecklistEvaluation }>;
  addComment(tenantContext: TenantContext, decisionId: string, input: unknown): Promise<ProductDecisionComment>;
  listComments(tenantContext: TenantContext, decisionId: string): Promise<ProductDecisionComment[]>;
};

export type DecisionServiceDependencies = {
  repository: ProductDecisionRepository;
  auditService?: DecisionAuditService;
  logger?: Logger;
};

function assertRequestedScope(tenantContext: TenantContext, scope: Partial<ProductDecisionScope>): void {
  assertTenantAccess(tenantContext, {
    organizationId: scope.organizationId ?? tenantContext.organizationId,
    workspaceId: scope.workspaceId ?? undefined,
    productId: scope.productId ?? undefined,
  });
}

function resolveScope(
  tenantContext: TenantContext,
  inputScope: Partial<ProductDecisionScope> = {},
): ProductDecisionScope {
  assertRequestedScope(tenantContext, inputScope);
  const tenantScope = scopeFromTenantContext(tenantContext);
  return {
    organizationId: tenantContext.organizationId,
    workspaceId: inputScope.workspaceId ?? tenantScope.workspaceId ?? null,
    productId: inputScope.productId ?? tenantScope.productId ?? null,
  };
}

async function appendAudit(
  auditService: DecisionAuditService,
  decision: ProductDecision,
  actorUserId: string,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await auditService.recordDecisionEvent({
    decisionId: decision.id,
    organizationId: decision.organizationId,
    workspaceId: decision.workspaceId,
    productId: decision.productId,
    eventType,
    actorUserId,
    payload,
  });
}

function extractCreateScope(input: ProductDecisionCreateInput): Partial<ProductDecisionScope> {
  return {
    workspaceId: input.workspaceId ?? undefined,
    productId: input.productId ?? undefined,
  };
}

function extractUpdateScope(input: ProductDecisionUpdateInput): Partial<ProductDecisionScope> {
  return {
    workspaceId: input.workspaceId,
    productId: input.productId,
  };
}

function assertScopeWideningMutationDenied(
  tenantContext: TenantContext,
  scope: Partial<ProductDecisionScope>,
): void {
  const isScopedCaller = tenantContext.workspaceId !== undefined || tenantContext.productId !== undefined;
  if (!isScopedCaller) {
    return;
  }

  if (scope.workspaceId === null) {
    throw new TenantContextError(
      "INVALID_CONTEXT",
      "Workspace scope mismatch for requested resource.",
    );
  }

  if (scope.productId === null) {
    throw new TenantContextError(
      "INVALID_CONTEXT",
      "Product scope mismatch for requested resource.",
    );
  }
}

export function createDecisionService(dependencies: DecisionServiceDependencies): DecisionService {
  const { repository } = dependencies;
  const logger = dependencies.logger ?? createLogger("decision-service");
  const auditService = dependencies.auditService ?? createDecisionAuditService({ repository });

  return {
    async createDecision(tenantContext, input) {
      const createInput = validateDecisionCreateInput(input);
      const scope = resolveScope(tenantContext, extractCreateScope(createInput));
      const decision = await repository.create(scope, tenantContext.userId, createInput);
      await appendAudit(auditService, decision, tenantContext.userId, "decision.created", {
        lifecycleStatus: decision.lifecycleStatus,
      });
      logger.info("Decision created.", {
        decisionId: decision.id,
        organizationId: decision.organizationId,
        workspaceId: decision.workspaceId,
        productId: decision.productId,
        lifecycleStatus: decision.lifecycleStatus,
      });
      return decision;
    },

    async listDecisions(tenantContext, input = {}) {
      const scope = resolveScope(tenantContext, {
        workspaceId: input.workspaceId,
        productId: input.productId,
      });
      const decisions = await repository.list(scope, {
        lifecycleStatus: input.lifecycleStatus,
      });
      logger.info("Decisions listed.", {
        organizationId: scope.organizationId,
        workspaceId: scope.workspaceId ?? null,
        productId: scope.productId ?? null,
        lifecycleStatus: input.lifecycleStatus ?? "all",
        count: decisions.length,
      });
      return decisions;
    },

    async getDecision(tenantContext, decisionId) {
      const scope = resolveScope(tenantContext);
      const decision = await repository.findById(scope, decisionId);
      const current = requireDecisionForScope(decision, decisionId);
      logger.info("Decision fetched.", {
        decisionId: current.id,
        organizationId: current.organizationId,
        workspaceId: current.workspaceId,
        productId: current.productId,
      });
      return current;
    },

    async updateDecision(tenantContext, decisionId, input) {
      const updateInput = validateDecisionUpdateInput(input);
      const updateScope = extractUpdateScope(updateInput);
      assertScopeWideningMutationDenied(tenantContext, updateScope);
      resolveScope(tenantContext, updateScope);
      const scope = resolveScope(tenantContext);
      const decision = await repository.update(scope, decisionId, tenantContext.userId, updateInput);
      const updated = requireDecisionForScope(decision, decisionId);
      await appendAudit(auditService, updated, tenantContext.userId, "decision.updated", {
        updatedFields: Object.keys(updateInput),
      });
      logger.info("Decision updated.", {
        decisionId: updated.id,
        organizationId: updated.organizationId,
        workspaceId: updated.workspaceId,
        productId: updated.productId,
        updatedFields: Object.keys(updateInput),
      });
      return updated;
    },

    async deleteDecision(tenantContext, decisionId) {
      const scope = resolveScope(tenantContext);
      const existingDecision = await repository.findById(scope, decisionId);
      const decision = requireDecisionForScope(existingDecision, decisionId);
      const removed = await repository.remove(scope, decisionId);
      if (!removed) {
        throw new DecisionDomainError(
          "DECISION_NOT_FOUND",
          `Decision '${decisionId}' was not found in the authorized tenant scope.`,
          404,
        );
      }
      await appendAudit(auditService, decision, tenantContext.userId, "decision.deleted", {});
      logger.info("Decision deleted.", {
        decisionId: decision.id,
        organizationId: decision.organizationId,
        workspaceId: decision.workspaceId,
        productId: decision.productId,
      });
    },

    async evaluateChecklist(tenantContext, decisionId) {
      const scope = resolveScope(tenantContext);
      const decision = await repository.findById(scope, decisionId);
      const current = requireDecisionForScope(decision, decisionId);
      logger.info("Decision checklist evaluated.", {
        decisionId: current.id,
        organizationId: current.organizationId,
        lifecycleStatus: current.lifecycleStatus,
      });
      return evaluateDecisionChecklist(current);
    },

    async transitionDecision(tenantContext, decisionId, targetStatus) {
      if (!isLifecycleStatus(targetStatus)) {
        throw new DecisionDomainError(
          "DECISION_VALIDATION_ERROR",
          "Invalid decision lifecycle status provided for transition.",
          400,
          {
            fieldErrors: {
              targetStatus:
                "targetStatus must be one of: framing, research, alignment, approved, implemented, superseded, archived.",
            },
          },
        );
      }

      const scope = resolveScope(tenantContext);
      const existingDecision = await repository.findById(scope, decisionId);
      const current = requireDecisionForScope(existingDecision, decisionId);
      const checklist = evaluateDecisionChecklist(current);
      assertDecisionTransitionAllowed(current, targetStatus, checklist);

      const transitioned = await repository.update(scope, decisionId, tenantContext.userId, {
        lifecycleStatus: targetStatus,
      });
      const nextDecision = requireDecisionForScope(transitioned, decisionId);
      const nextChecklist = evaluateDecisionChecklist(nextDecision);

      await appendAudit(auditService, nextDecision, tenantContext.userId, "decision.transitioned", {
        fromStatus: current.lifecycleStatus,
        toStatus: targetStatus,
        checklistCompletionRatio: nextChecklist.completionRatio,
      });
      logger.info("Decision transitioned.", {
        decisionId: nextDecision.id,
        organizationId: nextDecision.organizationId,
        workspaceId: nextDecision.workspaceId,
        productId: nextDecision.productId,
        fromStatus: current.lifecycleStatus,
        toStatus: targetStatus,
      });

      return {
        decision: nextDecision,
        checklist: nextChecklist,
      };
    },

    async addComment(tenantContext, decisionId, input) {
      const body = validateCommentBody((input as { body?: unknown })?.body);
      const scope = resolveScope(tenantContext);
      const decision = await repository.findById(scope, decisionId);
      const current = requireDecisionForScope(decision, decisionId);
      const comment = await repository.addComment(scope, current.id, tenantContext.userId, body);
      if (!comment) {
        throw new DecisionDomainError(
          "DECISION_NOT_FOUND",
          `Decision '${decisionId}' was not found in the authorized tenant scope.`,
          404,
        );
      }

      await appendAudit(auditService, current, tenantContext.userId, "decision.comment_added", {
        commentId: comment.id,
      });
      logger.info("Decision comment added.", {
        decisionId: current.id,
        commentId: comment.id,
        organizationId: current.organizationId,
      });
      return comment;
    },

    async listComments(tenantContext, decisionId) {
      const scope = resolveScope(tenantContext);
      const decision = await repository.findById(scope, decisionId);
      requireDecisionForScope(decision, decisionId);
      const comments = await repository.listComments(scope, decisionId);
      logger.info("Decision comments listed.", {
        decisionId,
        organizationId: scope.organizationId,
        workspaceId: scope.workspaceId ?? null,
        productId: scope.productId ?? null,
        count: comments.length,
      });
      return comments;
    },
  };
}
