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

function asNullableString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asNullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Number(value) : null;
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
  const strengths = asStringArray(autoResult.strengths);
  const improvements = asStringArray(autoResult.improvements);
  const nextSteps = asStringArray(modeSpecific.next_steps);
  const universalNextSteps = asStringArray(autoResult.next_steps);
  const warnings = asStringArray(autoResult.warnings);
  const questionBreakdown = Array.isArray(autoResult.question_breakdown)
    ? (autoResult.question_breakdown as QuestionBreakdown[])
    : [];
  const rawScore = asNullableNumber(autoResult.score);
  const maxMarks = asNullableNumber(autoResult.max_marks);
  const transcription = asNullableString(autoResult.transcription) || asNullableString(modeSpecific.transcription);
  const level = asNullableString(autoResult.level);
  const detailedFeedback = asNullableString(autoResult.detailed_feedback);
  const markCommentary = asNullableString(autoResult.mark_commentary);
  const exemplarAddition = asNullableString(autoResult.exemplar_addition) || asNullableString(modeSpecific.exemplar_addition);
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
    detailedFeedback ||
    (typeof autoResult.summary === "string" ? autoResult.summary : "") ||
    "No feedback has been generated yet.";
  const needsClearerPhoto =
    !processing &&
    score === null &&
    !grade &&
    /could not read enough text|no readable text/i.test(summary);

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
                : needsClearerPhoto
                  ? "Needs clearer photo"
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
                  : needsClearerPhoto
                    ? "The app could not read enough of the worksheet to mark it properly. Retake the photo and upload a clearer version."
                  : summary}
              </p>
            </div>
            <div className="rounded-[24px] bg-white/8 p-4">
              <p className="font-semibold text-white">Submission summary</p>
              <p className="mt-2">
                {submission.submission_files?.length || 0} photo{submission.submission_files?.length === 1 ? "" : "s"} uploaded
                {confidence !== null ? ` • ${confidence}% AI confidence` : ""}
                {rawScore !== null && maxMarks !== null ? ` • ${rawScore}/${maxMarks} raw marks` : ""}
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
            ) : (
              <>
                {(rawScore !== null && maxMarks !== null) || grade || level ? (
                  <div className="rounded-[24px] border border-brand-line bg-brand-surface p-4 text-brand-ink">
                    <p className="font-semibold">Mark overview</p>
                    <p className="mt-2">
                      {rawScore !== null && maxMarks !== null ? `${rawScore}/${maxMarks}` : "Raw score unavailable"}
                      {score !== null ? ` • ${score}%` : ""}
                      {grade ? ` • ${grade}` : ""}
                      {level ? ` • ${level}` : ""}
                    </p>
                  </div>
                ) : null}
                {markCommentary ? (
                  <div className="rounded-[24px] border border-brand-blue/20 bg-brand-blue/10 p-4 text-brand-ink">
                    <p className="font-semibold">Why this mark was awarded</p>
                    <p className="mt-2">{markCommentary}</p>
                  </div>
                ) : null}
                <div className="rounded-[24px] border border-brand-green/18 bg-brand-green/8 p-4 text-brand-ink">
                  <p className="font-semibold">Feedback</p>
                  <p className="mt-2">{detailedFeedback || summary}</p>
                </div>
                {strengths.length || improvements.length ? (
                  <div className="grid gap-4 lg:grid-cols-2">
                    {strengths.length ? (
                      <div className="rounded-[24px] border border-brand-green/18 bg-brand-green/8 p-4 text-brand-ink">
                        <p className="font-semibold">Strengths</p>
                        <ul className="mt-2 grid gap-2">
                          {strengths.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {improvements.length ? (
                      <div className="rounded-[24px] border border-brand-amber/18 bg-brand-amber/8 p-4 text-brand-ink">
                        <p className="font-semibold">To improve</p>
                        <ul className="mt-2 grid gap-2">
                          {improvements.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {details.length ? (
                  <div className="rounded-[24px] border border-brand-line bg-white p-4 text-brand-ink">
                    <p className="font-semibold">Marking detail</p>
                    <ul className="mt-2 grid gap-2">
                      {details.map((detail) => (
                        <li key={detail}>{detail}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {warnings.length ? (
                  <div className="rounded-[24px] border border-brand-red/20 bg-brand-red/10 p-4 text-brand-ink">
                    <p className="font-semibold">OCR warnings</p>
                    <ul className="mt-2 grid gap-2">
                      {warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </>
            )}
            {(universalNextSteps.length || nextSteps.length) && !processing ? (
              <div className="rounded-[24px] border border-brand-amber/18 bg-brand-amber/8 p-4">
                <p className="font-semibold text-brand-ink">Next steps</p>
                <ul className="mt-2 grid gap-2">
                  {(universalNextSteps.length ? universalNextSteps : nextSteps).map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {exemplarAddition && !processing ? (
              <div className="rounded-[24px] border border-brand-blue/20 bg-brand-blue/10 p-4 text-brand-ink">
                <p className="font-semibold">To push this higher</p>
                <p className="mt-2">{exemplarAddition}</p>
              </div>
            ) : null}
            {transcription && !processing ? (
              <details className="rounded-[24px] border border-brand-line bg-white p-4 text-brand-ink">
                <summary className="cursor-pointer font-semibold">View transcription</summary>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-brand-muted">{transcription}</p>
              </details>
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
