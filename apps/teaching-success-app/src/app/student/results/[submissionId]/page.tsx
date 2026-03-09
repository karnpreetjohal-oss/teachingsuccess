import Link from "next/link";
import { notFound } from "next/navigation";

import { PageIntro } from "@/components/page-intro";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getStudentSubmissionById } from "@/lib/server/student-data";

type QuestionBreakdown = {
  question?: string;
  student_answer?: string;
  expected_answer?: string;
  correct?: boolean;
  help?: string;
};

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function scoreTone(mark: number | null) {
  if (mark === null) return "amber";
  if (mark >= 80) return "green";
  if (mark >= 60) return "blue";
  return "red";
}

export default async function StudentResultsPage({
  params
}: {
  params: Promise<{ submissionId: string }>;
}) {
  const { submissionId } = await params;
  const submission = await getStudentSubmissionById(submissionId);
  if (!submission) {
    notFound();
  }

  const assignment = Array.isArray(submission.assignments) ? submission.assignments[0] : submission.assignments;
  const autoResult =
    submission.auto_result && typeof submission.auto_result === "object"
      ? (submission.auto_result as Record<string, unknown>)
      : {};
  const modeSpecific =
    autoResult.mode_specific && typeof autoResult.mode_specific === "object"
      ? (autoResult.mode_specific as Record<string, unknown>)
      : {};
  const details = asStringArray(autoResult.details);
  const nextSteps = asStringArray(modeSpecific.next_steps);
  const questionBreakdown = Array.isArray(autoResult.question_breakdown)
    ? (autoResult.question_breakdown as QuestionBreakdown[])
    : [];
  const score =
    submission.mark === null || submission.mark === undefined
      ? submission.auto_mark === null || submission.auto_mark === undefined
        ? null
        : Number(submission.auto_mark)
      : Number(submission.mark);
  const grade = submission.grade || submission.auto_grade || null;
  const confidence =
    submission.auto_confidence === null || submission.auto_confidence === undefined
      ? null
      : Number(submission.auto_confidence);
  const processing = Boolean(submission.ocr_processing) || !submission.auto_graded_at;
  const summary =
    submission.tutor_feedback ||
    submission.auto_feedback ||
    (typeof autoResult.summary === "string" ? autoResult.summary : "") ||
    "No feedback has been generated yet.";

  return (
    <>
      <PageIntro
        eyebrow="Results screen"
        title={processing ? `${assignment.title} is being marked.` : `${assignment.title} results`}
        description={
          processing
            ? "Your submission is in the marking queue. Check back shortly for the draft mark and feedback."
            : "See the latest score, feedback, and next steps for this piece of work."
        }
      />

      <section className="grid gap-4 lg:grid-cols-[.85fr_1.15fr]">
        <Card className="bg-brand-ink text-white">
          <CardHeader>
            <Badge variant={scoreTone(score) as "green" | "amber" | "blue" | "red"} className="w-fit">
              {processing
                ? "Processing"
                : score === null
                  ? grade || "Marked"
                  : `${score}%${grade ? ` • ${grade}` : ""}`}
            </Badge>
            <CardTitle className="text-white">{assignment.title}</CardTitle>
            <CardDescription className="text-white/72">
              {assignment.subject}
              {assignment.year_group ? ` • Year ${assignment.year_group}` : ""}
              {assignment.exam_board ? ` • ${assignment.exam_board}` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm leading-7 text-white/82">
            <div className="rounded-[24px] bg-white/8 p-4">
              <p className="font-semibold text-white">Status</p>
              <p className="mt-2">
                {processing
                  ? "OCR and AI marking are still running. Refresh this page in a moment to see the draft mark."
                  : summary}
              </p>
            </div>
            <div className="rounded-[24px] bg-white/8 p-4">
              <p className="font-semibold text-white">Submission summary</p>
              <p className="mt-2">
                {submission.submission_files?.length || 0} photo{submission.submission_files?.length === 1 ? "" : "s"} uploaded
                {confidence !== null ? ` • ${confidence}% AI confidence` : ""}
              </p>
            </div>
            {submission.tutor_feedback && submission.tutor_feedback !== submission.auto_feedback ? (
              <div className="rounded-[24px] bg-white/8 p-4">
                <p className="font-semibold text-white">Tutor note</p>
                <p className="mt-2">{submission.tutor_feedback}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{processing ? "What happens next" : "Feedback details"}</CardTitle>
            <CardDescription>
              {processing
                ? "This stays simple while marking is in progress."
                : "Score, detailed feedback, and next actions are kept together on one screen."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm leading-7 text-brand-muted">
            {processing ? (
              <div className="rounded-[24px] border border-brand-line bg-brand-surface p-4 text-brand-ink">
                Your submission is stored and the result will appear here as soon as the OCR function finishes.
              </div>
            ) : details.length ? (
              <div className="rounded-[24px] border border-brand-green/18 bg-brand-green/8 p-4">
                <p className="font-semibold text-brand-ink">Feedback detail</p>
                <ul className="mt-2 grid gap-2">
                  {details.map((detail) => (
                    <li key={detail}>{detail}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="rounded-[24px] border border-brand-green/18 bg-brand-green/8 p-4 text-brand-ink">
                {summary}
              </div>
            )}
            {nextSteps.length ? (
              <div className="rounded-[24px] border border-brand-amber/18 bg-brand-amber/8 p-4">
                <p className="font-semibold text-brand-ink">Next steps</p>
                <ul className="mt-2 grid gap-2">
                  {nextSteps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-3">
              <Link href="/student/practice" className={buttonVariants()}>
                Open redo view
              </Link>
              <Link href={`/student/upload?assignmentId=${assignment.id}`} className={buttonVariants({ variant: "outline" })}>
                Upload corrected work
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>

      {questionBreakdown.length ? (
        <section>
          <Card>
            <CardHeader>
              <CardTitle>Question breakdown</CardTitle>
              <CardDescription>Where the OCR pipeline extracted a clear answer, it appears here for quick review.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {questionBreakdown.map((question, index) => (
                <div key={`${question.question || "question"}-${index}`} className="rounded-2xl border border-brand-line bg-white px-4 py-4 text-sm leading-7 text-brand-ink">
                  <p className="font-semibold">{question.question || `Question ${index + 1}`}</p>
                  {question.student_answer ? <p className="mt-2">Student answer: {question.student_answer}</p> : null}
                  {question.expected_answer ? <p>Expected answer: {question.expected_answer}</p> : null}
                  <p className="mt-1 font-semibold">{question.correct ? "Correct" : "Needs review"}</p>
                  {question.help ? <p className="mt-1 text-brand-muted">{question.help}</p> : null}
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      ) : null}
    </>
  );
}
