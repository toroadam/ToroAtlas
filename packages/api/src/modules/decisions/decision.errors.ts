export type DecisionErrorCode =
  | "DECISION_VALIDATION_ERROR"
  | "DECISION_NOT_FOUND"
  | "DECISION_FORBIDDEN"
  | "DECISION_TRANSITION_NOT_ALLOWED"
  | "DECISION_CHECKLIST_INCOMPLETE"
  | "DECISION_CONFLICT";

export type DecisionErrorDetails = Record<string, unknown> | undefined;

export class DecisionDomainError extends Error {
  public readonly code: DecisionErrorCode;
  public readonly statusCode: number;
  public readonly details: DecisionErrorDetails;

  public constructor(
    code: DecisionErrorCode,
    message: string,
    statusCode: number,
    details?: DecisionErrorDetails,
  ) {
    super(message);
    this.name = "DecisionDomainError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class DecisionValidationError extends DecisionDomainError {
  public constructor(message: string, fieldErrors: Record<string, string>) {
    super("DECISION_VALIDATION_ERROR", message, 400, { fieldErrors });
    this.name = "DecisionValidationError";
  }
}

export function toDecisionDomainError(error: unknown): DecisionDomainError {
  if (error instanceof DecisionDomainError) {
    return error;
  }

  return new DecisionDomainError(
    "DECISION_CONFLICT",
    "Decision operation failed.",
    500,
  );
}
