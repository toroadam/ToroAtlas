"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { DecisionChecklist } from "@/components/decisions/DecisionChecklist";
import { DecisionFramingAssistant } from "@/components/decisions/DecisionFramingAssistant";
import { Button } from "@/components/ui/button";
import { DecisionMutationError, useDecisionMutations } from "@/hooks/useDecisionMutations";
import type {
  Decision,
  DecisionChecklistEvaluation,
  DecisionChecklistItem,
  DecisionPriority
} from "@/types/decisions";

const REQUIRED_FORM_FIELDS: Array<[keyof DecisionFormValues, string]> = [
  ["title", "Decision title is required."],
  ["decisionQuestion", "Decision question is required."],
  ["context", "Context is required."],
  ["ownerId", "Owner is required."],
  ["productArea", "Product area is required."],
  ["segment", "Segment is required."],
  ["successMetric", "Success metric is required."],
  ["problemStatement", "Problem statement is required."],
  ["decisionStatement", "Decision statement is required."],
  ["rationale", "Rationale is required."]
];

const PRIORITY_OPTIONS: DecisionPriority[] = ["low", "medium", "high", "critical"];

export type DecisionFormMode = "create" | "edit";

export type DecisionFormValues = Readonly<{
  title: string;
  workspaceId: string;
  productId: string;
  decisionQuestion: string;
  context: string;
  ownerId: string;
  priority: DecisionPriority;
  productArea: string;
  segment: string;
  successMetric: string;
  problemStatement: string;
  decisionStatement: string;
  rationale: string;
  optionsConsideredText: string;
}>;

type DecisionFormProps = Readonly<{
  mode: DecisionFormMode;
  decisionId?: string;
  initialDecision?: Decision | null;
  onSaved?: (decision: Decision) => void;
}>;

type FieldErrors = Record<string, string>;

function createDefaultFormValues(): DecisionFormValues {
  return {
    title: "",
    workspaceId: "",
    productId: "",
    decisionQuestion: "",
    context: "",
    ownerId: "",
    priority: "medium",
    productArea: "",
    segment: "",
    successMetric: "",
    problemStatement: "",
    decisionStatement: "",
    rationale: "",
    optionsConsideredText: ""
  };
}

function createFormValuesFromDecision(decision: Decision): DecisionFormValues {
  return {
    title: decision.title,
    workspaceId: decision.workspaceId ?? "",
    productId: decision.productId ?? "",
    decisionQuestion: decision.framing.decisionQuestion,
    context: decision.framing.context,
    ownerId: decision.framing.ownerId,
    priority: decision.framing.priority,
    productArea: decision.framing.productArea,
    segment: decision.framing.segment,
    successMetric: decision.framing.successMetric,
    problemStatement: decision.framing.problemStatement,
    decisionStatement: decision.framing.decisionStatement,
    rationale: decision.framing.rationale,
    optionsConsideredText: decision.framing.optionsConsidered.join("\n")
  };
}

function parseOptions(input: string): string[] {
  return input
    .split("\n")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function buildChecklistItem(
  id: string,
  label: string,
  passed: boolean,
  reason: string
): DecisionChecklistItem {
  return {
    id,
    label,
    passed,
    reason: passed ? "ok" : reason
  };
}

export function evaluateChecklistDraft(values: DecisionFormValues): DecisionChecklistEvaluation {
  const options = parseOptions(values.optionsConsideredText);
  const items = [
    buildChecklistItem(
      "decision-question",
      "Decision question is defined",
      values.decisionQuestion.trim().length >= 10,
      "decisionQuestion must include at least 10 characters."
    ),
    buildChecklistItem(
      "business-context",
      "Business context is documented",
      values.context.trim().length >= 10,
      "context must include at least 10 characters."
    ),
    buildChecklistItem(
      "owner-assigned",
      "Decision owner is assigned",
      values.ownerId.trim().length > 0,
      "ownerId is required."
    ),
    buildChecklistItem(
      "options-considered",
      "At least one option is captured",
      options.length > 0,
      "At least one optionsConsidered entry is required."
    ),
    buildChecklistItem(
      "problem-defined",
      "Problem statement is defined",
      values.problemStatement.trim().length >= 10,
      "problemStatement must include at least 10 characters."
    ),
    buildChecklistItem(
      "decision-defined",
      "Decision statement is defined",
      values.decisionStatement.trim().length >= 10,
      "decisionStatement must include at least 10 characters."
    ),
    buildChecklistItem(
      "rationale-defined",
      "Rationale is documented",
      values.rationale.trim().length >= 10,
      "rationale must include at least 10 characters."
    ),
    buildChecklistItem(
      "success-metric-defined",
      "Success metric is measurable",
      values.successMetric.trim().length >= 10,
      "successMetric must include at least 10 characters."
    )
  ];

  const passedCount = items.filter((item) => item.passed).length;
  return {
    isComplete: passedCount === items.length,
    completionRatio: items.length === 0 ? 1 : passedCount / items.length,
    items
  };
}

function validateRequiredFields(values: DecisionFormValues): FieldErrors {
  const nextErrors: FieldErrors = {};

  REQUIRED_FORM_FIELDS.forEach(([fieldName, message]) => {
    const value = values[fieldName];
    if (typeof value !== "string" || value.trim().length === 0) {
      nextErrors[fieldName] = message;
    }
  });

  if (parseOptions(values.optionsConsideredText).length === 0) {
    nextErrors.optionsConsideredText = "Provide at least one option.";
  }

  return nextErrors;
}

function renderError(fieldErrors: FieldErrors, key: string): JSX.Element | null {
  const message = fieldErrors[key];
  if (!message) {
    return null;
  }

  return <p className="text-xs text-destructive">{message}</p>;
}

export function DecisionForm({
  mode,
  decisionId,
  initialDecision,
  onSaved
}: DecisionFormProps): JSX.Element {
  const router = useRouter();
  const [values, setValues] = useState<DecisionFormValues>(() =>
    initialDecision ? createFormValuesFromDecision(initialDecision) : createDefaultFormValues()
  );
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const { createDecision, updateDecision, isSubmitting, error, clearError } =
    useDecisionMutations();

  useEffect(() => {
    if (!initialDecision) {
      return;
    }
    setValues(createFormValuesFromDecision(initialDecision));
  }, [initialDecision]);

  const checklist = useMemo(() => evaluateChecklistDraft(values), [values]);

  const updateField = (name: keyof DecisionFormValues, value: string): void => {
    setValues((previous) => ({
      ...previous,
      [name]: value
    }));
    setFieldErrors((previous) => {
      const next = { ...previous };
      delete next[name];
      return next;
    });
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    clearError();
    setFormError(null);

    const requiredErrors = validateRequiredFields(values);
    if (Object.keys(requiredErrors).length > 0) {
      setFieldErrors(requiredErrors);
      setFormError("Required framing fields are missing.");
      return;
    }

    const payload = {
      title: values.title.trim(),
      framing: {
        decisionQuestion: values.decisionQuestion.trim(),
        context: values.context.trim(),
        ownerId: values.ownerId.trim(),
        priority: values.priority,
        productArea: values.productArea.trim(),
        segment: values.segment.trim(),
        successMetric: values.successMetric.trim(),
        problemStatement: values.problemStatement.trim(),
        decisionStatement: values.decisionStatement.trim(),
        rationale: values.rationale.trim(),
        optionsConsidered: parseOptions(values.optionsConsideredText)
      },
      workspaceId: values.workspaceId.trim() || undefined,
      productId: values.productId.trim() || undefined
    };

    try {
      const decision =
        mode === "create"
          ? await createDecision(payload)
          : await updateDecision(decisionId ?? "", payload);

      if (onSaved) {
        onSaved(decision);
      } else {
        router.push(`/decisions/${decision.id}`);
        router.refresh();
      }
    } catch (submitError) {
      if (submitError instanceof DecisionMutationError) {
        if (Object.keys(submitError.fieldErrors).length > 0) {
          setFieldErrors((previous) => ({
            ...previous,
            ...submitError.fieldErrors
          }));
        }
        setFormError(submitError.message);
        return;
      }

      setFormError(
        submitError instanceof Error ? submitError.message : "Failed to save decision."
      );
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <form className="space-y-6 rounded-lg border p-6" onSubmit={(event) => void submit(event)}>
        <header>
          <h1 className="text-2xl font-semibold">
            {mode === "create" ? "Create decision" : "Edit decision"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Capture framing details completely before lifecycle progression.
          </p>
        </header>

        {formError || error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{formError ?? error}</p>
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <label htmlFor="title" className="text-sm font-medium">
              Title *
            </label>
            <input
              id="title"
              value={values.title}
              onChange={(event) => updateField("title", event.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            />
            {renderError(fieldErrors, "title")}
          </div>

          <div className="space-y-2">
            <label htmlFor="ownerId" className="text-sm font-medium">
              Owner *
            </label>
            <input
              id="ownerId"
              value={values.ownerId}
              onChange={(event) => updateField("ownerId", event.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            />
            {renderError(fieldErrors, "ownerId") ?? renderError(fieldErrors, "framing.ownerId")}
          </div>

          <div className="space-y-2">
            <label htmlFor="priority" className="text-sm font-medium">
              Priority *
            </label>
            <select
              id="priority"
              value={values.priority}
              onChange={(event) => updateField("priority", event.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              {PRIORITY_OPTIONS.map((priority) => (
                <option key={priority} value={priority}>
                  {priority.charAt(0).toUpperCase() + priority.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="workspaceId" className="text-sm font-medium">
              Workspace (optional)
            </label>
            <input
              id="workspaceId"
              value={values.workspaceId}
              onChange={(event) => updateField("workspaceId", event.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="productId" className="text-sm font-medium">
              Product (optional)
            </label>
            <input
              id="productId"
              value={values.productId}
              onChange={(event) => updateField("productId", event.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label htmlFor="decisionQuestion" className="text-sm font-medium">
              Decision question *
            </label>
            <textarea
              id="decisionQuestion"
              value={values.decisionQuestion}
              onChange={(event) => updateField("decisionQuestion", event.target.value)}
              rows={2}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
            {renderError(fieldErrors, "decisionQuestion") ??
              renderError(fieldErrors, "framing.decisionQuestion")}
            <DecisionFramingAssistant
              decisionId={decisionId}
              title={values.title}
              decisionQuestion={values.decisionQuestion}
              context={values.context}
              productArea={values.productArea}
              segment={values.segment}
              successMetric={values.successMetric}
              onAcceptSuggestion={(rewrittenDecisionQuestion) => {
                updateField("decisionQuestion", rewrittenDecisionQuestion);
              }}
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label htmlFor="context" className="text-sm font-medium">
              Context *
            </label>
            <textarea
              id="context"
              value={values.context}
              onChange={(event) => updateField("context", event.target.value)}
              rows={3}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
            {renderError(fieldErrors, "context") ??
              renderError(fieldErrors, "framing.context")}
          </div>

          <div className="space-y-2">
            <label htmlFor="productArea" className="text-sm font-medium">
              Product area *
            </label>
            <input
              id="productArea"
              value={values.productArea}
              onChange={(event) => updateField("productArea", event.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            />
            {renderError(fieldErrors, "productArea") ??
              renderError(fieldErrors, "framing.productArea")}
          </div>

          <div className="space-y-2">
            <label htmlFor="segment" className="text-sm font-medium">
              Segment *
            </label>
            <input
              id="segment"
              value={values.segment}
              onChange={(event) => updateField("segment", event.target.value)}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            />
            {renderError(fieldErrors, "segment") ??
              renderError(fieldErrors, "framing.segment")}
          </div>

          <div className="space-y-2 md:col-span-2">
            <label htmlFor="successMetric" className="text-sm font-medium">
              Success metric *
            </label>
            <textarea
              id="successMetric"
              value={values.successMetric}
              onChange={(event) => updateField("successMetric", event.target.value)}
              rows={2}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
            {renderError(fieldErrors, "successMetric") ??
              renderError(fieldErrors, "framing.successMetric")}
          </div>

          <div className="space-y-2 md:col-span-2">
            <label htmlFor="problemStatement" className="text-sm font-medium">
              Problem statement *
            </label>
            <textarea
              id="problemStatement"
              value={values.problemStatement}
              onChange={(event) => updateField("problemStatement", event.target.value)}
              rows={3}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
            {renderError(fieldErrors, "problemStatement") ??
              renderError(fieldErrors, "framing.problemStatement")}
          </div>

          <div className="space-y-2 md:col-span-2">
            <label htmlFor="decisionStatement" className="text-sm font-medium">
              Decision statement *
            </label>
            <textarea
              id="decisionStatement"
              value={values.decisionStatement}
              onChange={(event) => updateField("decisionStatement", event.target.value)}
              rows={3}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
            {renderError(fieldErrors, "decisionStatement") ??
              renderError(fieldErrors, "framing.decisionStatement")}
          </div>

          <div className="space-y-2 md:col-span-2">
            <label htmlFor="rationale" className="text-sm font-medium">
              Rationale *
            </label>
            <textarea
              id="rationale"
              value={values.rationale}
              onChange={(event) => updateField("rationale", event.target.value)}
              rows={3}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
            {renderError(fieldErrors, "rationale") ??
              renderError(fieldErrors, "framing.rationale")}
          </div>

          <div className="space-y-2 md:col-span-2">
            <label htmlFor="optionsConsideredText" className="text-sm font-medium">
              Options considered (one per line) *
            </label>
            <textarea
              id="optionsConsideredText"
              value={values.optionsConsideredText}
              onChange={(event) => updateField("optionsConsideredText", event.target.value)}
              rows={4}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="Option A&#10;Option B"
            />
            {renderError(fieldErrors, "optionsConsideredText") ??
              renderError(fieldErrors, "framing.optionsConsidered")}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? mode === "create"
                ? "Creating..."
                : "Saving..."
              : mode === "create"
                ? "Create decision"
                : "Save changes"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        </div>
      </form>

      <aside className="space-y-3">
        <DecisionChecklist checklist={checklist} title="Pre-submit checklist" />
        {!checklist.isComplete ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
            Checklist is incomplete. You can still save draft updates, but lifecycle progression
            may be blocked until all checklist criteria pass.
          </p>
        ) : null}
      </aside>
    </div>
  );
}
