"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type TutorReviewCardProps = {
  submissionId: string;
  student: string;
  title: string;
  subject: string;
  status: string;
  notes: string;
  autoMark: number | null;
  autoGrade: string | null;
  autoFeedback: string | null;
  tutorMark: number | null;
  tutorGrade: string | null;
  tutorFeedback: string | null;
};

function statusVariant(status: string) {
  if (status === "AI draft ready") return "blue";
  if (status === "Published") return "green";
  return "amber";
}

export function TutorReviewCard({
  submissionId,
  student,
  title,
  subject,
  status,
  notes,
  autoMark,
  autoGrade,
  autoFeedback,
  tutorMark,
  tutorGrade,
  tutorFeedback
}: TutorReviewCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mark, setMark] = useState(tutorMark === null || tutorMark === undefined ? autoMark?.toString() || "" : String(tutorMark));
  const [grade, setGrade] = useState(tutorGrade || autoGrade || "");
  const [feedback, setFeedback] = useState(tutorFeedback || autoFeedback || "");
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const publish = (mode: "manual" | "publish_auto") => {
    setError(null);
    setStatusMessage(null);

    startTransition(async () => {
      try {
        const response = await fetch(`/app/api/tutor/submissions/${submissionId}/publish`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(
            mode === "publish_auto"
              ? { mode }
              : {
                  mode,
                  mark,
                  grade,
                  feedback
                }
          )
        });

        const payload = (await response.json()) as { error?: string };
        if (!response.ok) {
          setError(payload.error || "Could not publish result.");
          return;
        }

        setStatusMessage(mode === "publish_auto" ? "Auto result published." : "Tutor result published.");
        router.refresh();
      } catch (publishError) {
        setError(publishError instanceof Error ? publishError.message : "Could not publish result.");
      }
    });
  };

  return (
    <Card>
      <CardHeader className="gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>
            {student} • {subject}
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={statusVariant(status) as "blue" | "green" | "amber"}>{status}</Badge>
          {autoMark !== null ? <Badge variant="gold">{autoMark}%{autoGrade ? ` • ${autoGrade}` : ""}</Badge> : null}
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-sm leading-7 text-brand-muted">{notes}</p>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-brand-line bg-brand-surface px-4 py-4 text-sm leading-7 text-brand-ink">
            <p className="font-semibold">Auto draft</p>
            <p className="mt-2">{autoFeedback || "No AI draft feedback yet."}</p>
          </div>

          <div className="grid gap-3 rounded-2xl border border-brand-line bg-white px-4 py-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-sm font-semibold text-brand-ink" htmlFor={`mark-${submissionId}`}>
                  Final mark
                </label>
                <input
                  id={`mark-${submissionId}`}
                  value={mark}
                  onChange={(event) => setMark(event.target.value)}
                  inputMode="numeric"
                  className="h-12 rounded-2xl border border-brand-line bg-white px-4 text-sm text-brand-ink outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/35"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-semibold text-brand-ink" htmlFor={`grade-${submissionId}`}>
                  Grade
                </label>
                <input
                  id={`grade-${submissionId}`}
                  value={grade}
                  onChange={(event) => setGrade(event.target.value)}
                  className="h-12 rounded-2xl border border-brand-line bg-white px-4 text-sm text-brand-ink outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/35"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-semibold text-brand-ink" htmlFor={`feedback-${submissionId}`}>
                Tutor feedback
              </label>
              <textarea
                id={`feedback-${submissionId}`}
                value={feedback}
                onChange={(event) => setFeedback(event.target.value)}
                className="min-h-28 rounded-2xl border border-brand-line bg-white px-4 py-3 text-sm text-brand-ink outline-none focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/35"
              />
            </div>
          </div>
        </div>

        {statusMessage ? (
          <div className="rounded-2xl border border-brand-green/20 bg-brand-green/8 px-4 py-3 text-sm text-brand-ink">
            {statusMessage}
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
            onClick={() => publish("manual")}
            className={buttonVariants()}
          >
            {isPending ? "Publishing..." : "Publish tutor result"}
          </button>
          <button
            type="button"
            disabled={isPending || autoMark === null}
            onClick={() => publish("publish_auto")}
            className={buttonVariants({ variant: "outline" })}
          >
            Use auto as final
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
