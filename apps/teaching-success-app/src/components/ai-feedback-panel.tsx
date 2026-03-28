"use client";

import { useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";

type AiFeedbackPanelProps = {
  submissionId: string;
  onApprove: (comment: string, grade: string) => void;
};

type FeedbackState = {
  comment: string;
  grade: string;
  mark: number | null;
  strengths: string[];
  fixNext: string[];
  confidence: number | null;
  cached: boolean;
};

export function AiFeedbackPanel({ submissionId, onApprove }: AiFeedbackPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<FeedbackState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const generate = (force = false) => {
    setError(null);
    setCopied(null);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/tutor/submissions/${submissionId}/ai-feedback`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(force ? { force: true } : {})
        });

        const payload = (await response.json()) as {
          error?: string;
          comment?: string;
          grade?: string;
          mark?: number | null;
          strengths?: string[];
          fixNext?: string[];
          confidence?: number | null;
          cached?: boolean;
        };

        if (!response.ok || !payload.comment) {
          setError(payload.error || "Could not generate AI review feedback.");
          return;
        }

        setResult({
          comment: payload.comment,
          grade: payload.grade || "",
          mark: payload.mark ?? null,
          strengths: Array.isArray(payload.strengths) ? payload.strengths : [],
          fixNext: Array.isArray(payload.fixNext) ? payload.fixNext : [],
          confidence: typeof payload.confidence === "number" ? payload.confidence : null,
          cached: Boolean(payload.cached)
        });
      } catch (generationError) {
        setError(generationError instanceof Error ? generationError.message : "Could not generate AI review feedback.");
      }
    });
  };

  return (
    <div className="grid gap-3 rounded-2xl border border-brand-line bg-white px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-brand-ink">AI tutor suggestion</p>
          <p className="text-sm leading-6 text-brand-muted">
            Generate a second-pass feedback draft from the submission, OCR text, and existing auto-marking output.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {result?.cached ? <Badge variant="neutral">Cached suggestion</Badge> : null}
          {result?.confidence !== null && result?.confidence !== undefined ? (
            <Badge variant="blue">{result.confidence}% confidence</Badge>
          ) : null}
        </div>
      </div>

      {result ? (
        <div className="grid gap-3 rounded-2xl border border-brand-line bg-brand-surface px-4 py-4 text-sm text-brand-ink">
          <div className="flex flex-wrap gap-2">
            {result.mark !== null ? <Badge variant="gold">Suggested mark {result.mark}%</Badge> : null}
            {result.grade ? <Badge variant="amber">Suggested grade {result.grade}</Badge> : null}
          </div>
          <p className="leading-7">{result.comment}</p>
          {result.strengths.length ? (
            <div>
              <p className="font-semibold">Strengths</p>
              <ul className="mt-2 list-disc pl-5 leading-7 text-brand-muted">
                {result.strengths.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {result.fixNext.length ? (
            <div>
              <p className="font-semibold">Fix next</p>
              <ul className="mt-2 list-disc pl-5 leading-7 text-brand-muted">
                {result.fixNext.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {copied ? (
        <div className="rounded-2xl border border-brand-green/20 bg-brand-green/8 px-4 py-3 text-sm text-brand-ink">
          {copied}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-brand-red/20 bg-brand-red/10 px-4 py-3 text-sm text-brand-ink">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={isPending}
          onClick={() => generate(Boolean(result))}
          className={buttonVariants({ variant: result ? "outline" : "secondary", size: "sm" })}
        >
          {isPending ? "Generating..." : result ? "Refresh AI suggestion" : "Generate AI suggestion"}
        </button>
        <button
          type="button"
          disabled={isPending || !result}
          onClick={() => {
            if (!result) return;
            onApprove(result.comment, result.grade);
            setCopied("AI suggestion copied into the final grade and feedback fields.");
          }}
          className={buttonVariants({ size: "sm" })}
        >
          Use in final feedback
        </button>
      </div>
    </div>
  );
}
