import type { TenantContext } from "../../auth/clerk.js";
import { DecisionDomainError } from "../../modules/decisions/decision.errors.js";
import { createLogger, type Logger } from "../../observability/logger.js";
import type { DecisionAuditService } from "../audit/auditService.js";

const TOPIC_MIN_LENGTH = 5;

export type DecisionFramingConfidence = "low" | "medium" | "high";

export type DecisionFramingSuggestion = Readonly<{
  suggestionId: string;
  suggestionType: "decision-question";
  advisoryOnly: true;
  originalTopic: string;
  rewrittenDecisionQuestion: string;
  rationale: string;
  assumptions: string[];
  confidence: DecisionFramingConfidence;
  provider: "heuristic" | "model";
  generatedAt: string;
}>;

export type DecisionFramingRequest = Readonly<{
  topic: string;
  context: string | null;
  productArea: string | null;
  segment: string | null;
  successMetric: string | null;
  decisionId: string | null;
}>;

export type DecisionFramingModelProvider = {
  generateSuggestion(input: {
    tenantContext: TenantContext;
    traceId: string;
    prompt: string;
    request: DecisionFramingRequest;
  }): Promise<unknown>;
};

export type DecisionFramingService = {
  suggestDecisionQuestion(
    tenantContext: TenantContext,
    input: unknown,
  ): Promise<DecisionFramingSuggestion>;
};

export type DecisionFramingServiceDependencies = {
  provider?: DecisionFramingModelProvider;
  nowProvider?: () => string;
  idGenerator?: () => string;
  auditService?: DecisionAuditService;
  logger?: Logger;
};

type FramingRequestInputPayload = {
  topic?: unknown;
  context?: unknown;
  productArea?: unknown;
  segment?: unknown;
  successMetric?: unknown;
  decisionId?: unknown;
};

type ProviderSuggestion = {
  rewrittenDecisionQuestion: string;
  rationale: string;
  assumptions?: string[];
  confidence?: DecisionFramingConfidence;
};

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function sanitizeTopic(topic: string): string {
  const normalized = collapseWhitespace(topic);
  return normalized.replace(/[.!?]+$/, "");
}

function normalizeOptionalString(value: unknown, fieldName: string): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new DecisionDomainError(
      "DECISION_VALIDATION_ERROR",
      "AI framing payload failed validation.",
      400,
      {
        fieldErrors: {
          [fieldName]: "Field must be a non-empty string when provided.",
        },
      },
    );
  }

  const normalized = collapseWhitespace(value);
  if (!normalized) {
    throw new DecisionDomainError(
      "DECISION_VALIDATION_ERROR",
      "AI framing payload failed validation.",
      400,
      {
        fieldErrors: {
          [fieldName]: "Field must be a non-empty string when provided.",
        },
      },
    );
  }

  return normalized;
}

function normalizeOptionalDecisionId(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new DecisionDomainError(
      "DECISION_VALIDATION_ERROR",
      "AI framing payload failed validation.",
      400,
      {
        fieldErrors: {
          decisionId: "decisionId must be a non-empty string when provided.",
        },
      },
    );
  }

  const normalized = collapseWhitespace(value);
  if (!normalized) {
    throw new DecisionDomainError(
      "DECISION_VALIDATION_ERROR",
      "AI framing payload failed validation.",
      400,
      {
        fieldErrors: {
          decisionId: "decisionId must be a non-empty string when provided.",
        },
      },
    );
  }

  return normalized;
}

function parseFramingRequest(input: unknown): DecisionFramingRequest {
  if (!input || typeof input !== "object") {
    throw new DecisionDomainError(
      "DECISION_VALIDATION_ERROR",
      "AI framing payload is required.",
      400,
      {
        fieldErrors: {
          body: "Provide a payload object with at least the topic field.",
        },
      },
    );
  }

  const payload = input as FramingRequestInputPayload;
  if (typeof payload.topic !== "string") {
    throw new DecisionDomainError(
      "DECISION_VALIDATION_ERROR",
      "AI framing payload failed validation.",
      400,
      {
        fieldErrors: {
          topic: "topic is required and must be a non-empty string.",
        },
      },
    );
  }

  const topic = sanitizeTopic(payload.topic);
  if (topic.length < TOPIC_MIN_LENGTH) {
    throw new DecisionDomainError(
      "DECISION_VALIDATION_ERROR",
      "AI framing payload failed validation.",
      400,
      {
        fieldErrors: {
          topic: `topic must include at least ${TOPIC_MIN_LENGTH} characters.`,
        },
      },
    );
  }

  return {
    topic,
    context: normalizeOptionalString(payload.context, "context"),
    productArea: normalizeOptionalString(payload.productArea, "productArea"),
    segment: normalizeOptionalString(payload.segment, "segment"),
    successMetric: normalizeOptionalString(payload.successMetric, "successMetric"),
    decisionId: normalizeOptionalDecisionId(payload.decisionId),
  };
}

function createPrompt(request: DecisionFramingRequest): string {
  const contextLine = request.context ? `Context: ${request.context}` : "Context: n/a";
  const productAreaLine = request.productArea ? `Product area: ${request.productArea}` : "Product area: n/a";
  const segmentLine = request.segment ? `Segment: ${request.segment}` : "Segment: n/a";
  const successMetricLine = request.successMetric
    ? `Success metric: ${request.successMetric}`
    : "Success metric: n/a";

  return [
    "You are an advisory decision framing assistant.",
    "Rewrite rough topics into one explicit decision question.",
    "Return JSON with keys: rewrittenDecisionQuestion, rationale, assumptions, confidence.",
    "Do not mutate user content directly; suggestions are advisory-only.",
    `Topic: ${request.topic}`,
    contextLine,
    productAreaLine,
    segmentLine,
    successMetricLine,
  ].join("\n");
}

function buildHeuristicQuestion(request: DecisionFramingRequest): string {
  const scopeParts = [
    request.productArea ? `in ${request.productArea}` : null,
    request.segment ? `for ${request.segment}` : null,
  ].filter((part): part is string => Boolean(part));
  const scopeSuffix = scopeParts.length > 0 ? ` ${scopeParts.join(" ")}` : "";
  const objective = request.successMetric
    ? `to achieve ${request.successMetric}`
    : "to deliver measurable business outcomes";

  return `What decision should we make about ${request.topic}${scopeSuffix} ${objective}?`;
}

function buildHeuristicSuggestion(
  request: DecisionFramingRequest,
  generatedAt: string,
  suggestionId: string,
): DecisionFramingSuggestion {
  const rewrittenDecisionQuestion = buildHeuristicQuestion(request);
  const assumptions = [
    request.context ? "Business context supplied by user input." : "Context inferred from topic only.",
    request.successMetric
      ? "Success metric was included to keep the question outcome-focused."
      : "No success metric provided; question keeps a generic outcomes focus.",
  ];

  return {
    suggestionId,
    suggestionType: "decision-question",
    advisoryOnly: true,
    originalTopic: request.topic,
    rewrittenDecisionQuestion,
    rationale:
      "Converted a rough topic into an explicit decision question with scope and measurable outcome framing.",
    assumptions,
    confidence: request.successMetric ? "high" : "medium",
    provider: "heuristic",
    generatedAt,
  };
}

function toValidSuggestion(
  input: unknown,
  request: DecisionFramingRequest,
  generatedAt: string,
  suggestionId: string,
): DecisionFramingSuggestion {
  if (!input || typeof input !== "object") {
    throw new DecisionDomainError(
      "DECISION_CONFLICT",
      "AI framing provider returned malformed suggestion output.",
      502,
      {
        reason: "provider_response_invalid",
      },
    );
  }

  const providerSuggestion = input as ProviderSuggestion;
  if (
    typeof providerSuggestion.rewrittenDecisionQuestion !== "string" ||
    typeof providerSuggestion.rationale !== "string"
  ) {
    throw new DecisionDomainError(
      "DECISION_CONFLICT",
      "AI framing provider returned malformed suggestion output.",
      502,
      {
        reason: "provider_response_invalid",
      },
    );
  }

  const rewrittenDecisionQuestion = collapseWhitespace(providerSuggestion.rewrittenDecisionQuestion);
  const rationale = collapseWhitespace(providerSuggestion.rationale);
  if (!rewrittenDecisionQuestion || !rationale) {
    throw new DecisionDomainError(
      "DECISION_CONFLICT",
      "AI framing provider returned malformed suggestion output.",
      502,
      {
        reason: "provider_response_invalid",
      },
    );
  }

  const assumptions = Array.isArray(providerSuggestion.assumptions)
    ? providerSuggestion.assumptions
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => collapseWhitespace(entry))
        .filter((entry) => entry.length > 0)
    : [];

  const confidence: DecisionFramingConfidence =
    providerSuggestion.confidence === "low" ||
    providerSuggestion.confidence === "medium" ||
    providerSuggestion.confidence === "high"
      ? providerSuggestion.confidence
      : "medium";

  return {
    suggestionId,
    suggestionType: "decision-question",
    advisoryOnly: true,
    originalTopic: request.topic,
    rewrittenDecisionQuestion,
    rationale,
    assumptions,
    confidence,
    provider: "model",
    generatedAt,
  };
}

export function createDecisionFramingService(
  dependencies: DecisionFramingServiceDependencies = {},
): DecisionFramingService {
  const nowProvider = dependencies.nowProvider ?? (() => new Date().toISOString());
  const idGenerator = dependencies.idGenerator ?? (() => crypto.randomUUID());
  const provider = dependencies.provider;
  const auditService = dependencies.auditService;
  const logger = dependencies.logger ?? createLogger("decision-framing-service");

  return {
    async suggestDecisionQuestion(tenantContext, input) {
      const request = parseFramingRequest(input);
      const generatedAt = nowProvider();
      const suggestionId = idGenerator();
      let suggestion: DecisionFramingSuggestion;

      if (!provider) {
        suggestion = buildHeuristicSuggestion(request, generatedAt, suggestionId);
      } else {
        const prompt = createPrompt(request);
        const traceId = idGenerator();
        try {
          const providerOutput = await provider.generateSuggestion({
            tenantContext,
            traceId,
            prompt,
            request,
          });
          suggestion = toValidSuggestion(providerOutput, request, generatedAt, suggestionId);
        } catch (error) {
          if (error instanceof DecisionDomainError) {
            throw error;
          }

          logger.error("Decision framing provider unavailable.", {
            organizationId: tenantContext.organizationId,
            workspaceId: tenantContext.workspaceId ?? null,
            productId: tenantContext.productId ?? null,
            reason: error instanceof Error ? error.message : "unknown",
          });

          throw new DecisionDomainError(
            "DECISION_CONFLICT",
            "AI framing provider is unavailable.",
            502,
            {
              reason: "provider_unavailable",
            },
          );
        }
      }

      logger.info("Decision framing suggestion generated.", {
        organizationId: tenantContext.organizationId,
        workspaceId: tenantContext.workspaceId ?? null,
        productId: tenantContext.productId ?? null,
        decisionId: request.decisionId,
        suggestionId,
        provider: suggestion.provider,
      });

      if (auditService && request.decisionId) {
        await auditService.recordDecisionEvent({
          decisionId: request.decisionId,
          organizationId: tenantContext.organizationId,
          workspaceId: tenantContext.workspaceId ?? null,
          productId: tenantContext.productId ?? null,
          eventType: "decision.framing_suggestion_generated",
          actorUserId: tenantContext.userId,
          payload: {
            suggestionId,
            provider: suggestion.provider,
            confidence: suggestion.confidence,
            advisoryOnly: suggestion.advisoryOnly,
          },
        });
      }

      return suggestion;
    },
  };
}
