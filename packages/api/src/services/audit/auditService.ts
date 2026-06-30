import { DecisionDomainError } from "../../modules/decisions/decision.errors.js";
import type {
  ProductDecisionAuditEvent,
  ProductDecisionRepository,
} from "../../modules/decisions/index.js";
import { createLogger, type Logger } from "../../observability/logger.js";

export type DecisionAuditEventInput = Omit<ProductDecisionAuditEvent, "id" | "happenedAt">;

export type DecisionAuditService = {
  recordDecisionEvent(event: DecisionAuditEventInput): Promise<void>;
};

export type DecisionAuditServiceDependencies = {
  repository: ProductDecisionRepository;
  logger?: Logger;
};

export function createDecisionAuditService(
  dependencies: DecisionAuditServiceDependencies,
): DecisionAuditService {
  const logger = dependencies.logger ?? createLogger("decision-audit-service");

  return {
    async recordDecisionEvent(event) {
      try {
        await dependencies.repository.appendAuditEvent(event);
        logger.info("Decision audit event recorded.", {
          eventType: event.eventType,
          decisionId: event.decisionId,
          actorUserId: event.actorUserId,
          organizationId: event.organizationId,
        });
      } catch (error) {
        logger.error("Decision audit event failed.", {
          eventType: event.eventType,
          decisionId: event.decisionId,
          actorUserId: event.actorUserId,
          reason: error instanceof Error ? error.message : "unknown",
        });

        throw new DecisionDomainError(
          "DECISION_CONFLICT",
          "Decision audit event recording failed.",
          500,
          {
            reason: "audit_record_failed",
          },
        );
      }
    },
  };
}
