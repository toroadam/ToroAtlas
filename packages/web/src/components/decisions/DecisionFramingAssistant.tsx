"use client";

import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDecisionFraming } from "@/hooks/useDecisionFraming";

type DecisionFramingAssistantProps = Readonly<{
  decisionId?: string;
  title: string;
  decisionQuestion: string;
  context: string;
  productArea: string;
  segment: string;
  successMetric: string;
  onAcceptSuggestion: (rewrittenDecisionQuestion: string) => void;
}>;

function deriveInitialTopic(decisionQuestion: string, title: string): string {
  const preferred = decisionQuestion.trim();
  if (preferred.length > 0) {
    return preferred;
  }
  return title.trim();
}

export function DecisionFramingAssistant({
  decisionId,
  title,
  decisionQuestion,
  context,
  productArea,
  segment,
  successMetric,
  onAcceptSuggestion,
}: DecisionFramingAssistantProps): JSX.Element {
  const {
    suggestion,
    isLoading,
    error,
    fieldErrors,
    requestSuggestion,
    clearError,
    clearSuggestion,
  } = useDecisionFraming();

  const [topicInput, setTopicInput] = useState(() => deriveInitialTopic(decisionQuestion, title));
  const [hasAcceptedSuggestion, setHasAcceptedSuggestion] = useState(false);
  const [hasCustomizedTopic, setHasCustomizedTopic] = useState(false);

  const derivedTopic = useMemo(
    () => deriveInitialTopic(decisionQuestion, title),
    [decisionQuestion, title],
  );

  useEffect(() => {
    if (!hasCustomizedTopic) {
      setTopicInput(derivedTopic);
    }
  }, [derivedTopic, hasCustomizedTopic]);

  const onGenerateSuggestion = async (): Promise<void> => {
    setHasAcceptedSuggestion(false);
    clearError();
    await requestSuggestion({
      topic: topicInput.trim(),
      context: context.trim() || undefined,
      productArea: productArea.trim() || undefined,
      segment: segment.trim() || undefined,
      successMetric: successMetric.trim() || undefined,
      decisionId: decisionId?.trim() || undefined,
    });
  };

  return (
    <section className="rounded-md border border-dashed bg-muted/20 p-4">
      <header className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-muted-foreground" />
        <div>
          <h3 className="text-sm font-semibold">AI framing assistant</h3>
          <p className="text-xs text-muted-foreground">
            Advisory only. Suggestions are applied only when you accept.
          </p>
        </div>
      </header>

      <div className="mt-3 space-y-2">
        <label htmlFor="framing-topic-input" className="text-xs font-medium text-muted-foreground">
          Topic to refine
        </label>
        <textarea
          id="framing-topic-input"
          rows={2}
          value={topicInput}
          onChange={(event) => {
            setTopicInput(event.target.value);
            setHasCustomizedTopic(true);
          }}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          placeholder="Describe the rough decision topic to refine..."
        />
        {fieldErrors.topic ? <p className="text-xs text-destructive">{fieldErrors.topic}</p> : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => void onGenerateSuggestion()}
          disabled={isLoading}
        >
          {isLoading ? "Generating..." : "Generate suggestion"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            setTopicInput(derivedTopic);
            setHasCustomizedTopic(false);
          }}
          disabled={isLoading}
        >
          Use form draft text
        </Button>
      </div>

      {error ? (
        <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}

      {suggestion ? (
        <div className="mt-4 rounded-md border bg-background p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Suggested decision question
          </p>
          <p className="mt-2 text-sm font-medium">{suggestion.rewrittenDecisionQuestion}</p>
          <p className="mt-2 text-xs text-muted-foreground">{suggestion.rationale}</p>
          {suggestion.assumptions.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
              {suggestion.assumptions.map((assumption) => (
                <li key={assumption}>{assumption}</li>
              ))}
            </ul>
          ) : null}
          <p className="mt-2 text-[11px] text-muted-foreground">
            Provider: {suggestion.provider} · Confidence: {suggestion.confidence}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                onAcceptSuggestion(suggestion.rewrittenDecisionQuestion);
                setHasAcceptedSuggestion(true);
              }}
            >
              Accept suggestion
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                clearSuggestion();
                setHasAcceptedSuggestion(false);
              }}
            >
              Reject suggestion
            </Button>
          </div>
          {hasAcceptedSuggestion ? (
            <p className="mt-2 text-xs text-emerald-700">
              Suggestion accepted. You can still edit the decision question manually.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
