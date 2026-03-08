import { PageIntro } from "@/components/page-intro";
import { TutorReviewCard } from "@/components/tutor-review-card";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getTutorDataBundle,
  getTutorSubmissionDraftSource,
  getTutorSubmissionInferenceMeta,
  getTutorSubmissionReviewLabels,
  getTutorSubmissionScore,
  getTutorSubmissionSummary,
  labelTutorStudent
} from "@/lib/server/tutor-data";

export default async function TutorSubmissionReviewPage() {
  const { assignments } = await getTutorDataBundle({ assignments: true });
  const reviewQueue = assignments
    .map((assignment) => {
      const latestSubmission = [...assignment.submissions]
        .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())[0] ?? null;
      if (!latestSubmission) {
        return null;
      }

      const score = getTutorSubmissionScore(latestSubmission);
      const inference = getTutorSubmissionInferenceMeta(latestSubmission);
      const reviewLabels = getTutorSubmissionReviewLabels(latestSubmission);
      const draftSource = getTutorSubmissionDraftSource(latestSubmission);
      const status = latestSubmission.ocr_processing
        ? "Pending OCR"
        : latestSubmission.mark !== null || latestSubmission.tutor_feedback
          ? "Published"
          : latestSubmission.auto_graded_at
            ? "AI draft ready"
            : "Awaiting mark";

      return {
        id: latestSubmission.id,
        student: labelTutorStudent(assignment.student),
        title: assignment.title,
        subject: assignment.subject,
        status,
        notes:
          status === "Pending OCR"
            ? `Submitted ${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(latestSubmission.submitted_at))}. OCR is still processing.`
            : status === "Published"
              ? `Final feedback published${score !== null ? ` at ${score}%` : ""}.`
              : `${getTutorSubmissionSummary(latestSubmission)}${score !== null ? ` Draft mark ${score}%.` : ""}${
                  inference?.subjectInferred || inference?.titleInferred
                    ? ` ${[
                        inference.subjectInferred ? "Subject inferred from OCR." : "",
                        inference.titleInferred ? "Title inferred from OCR." : ""
                      ]
                        .filter(Boolean)
                        .join(" ")}`
                    : ""
                }`,
        autoMark: latestSubmission.auto_mark === null || latestSubmission.auto_mark === undefined ? null : Number(latestSubmission.auto_mark),
        autoGrade: latestSubmission.auto_grade || null,
        autoFeedback: latestSubmission.auto_feedback || null,
        tutorMark: latestSubmission.mark === null || latestSubmission.mark === undefined ? null : Number(latestSubmission.mark),
        tutorGrade: latestSubmission.grade || null,
        tutorFeedback: latestSubmission.tutor_feedback || null,
        draftSource,
        reviewLabels,
        autoConfidence:
          latestSubmission.auto_confidence === null || latestSubmission.auto_confidence === undefined
            ? null
            : Number(latestSubmission.auto_confidence)
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => {
      const order = { "AI draft ready": 0, "Pending OCR": 1, "Awaiting mark": 2, Published: 3 };
      return (order[a.status as keyof typeof order] ?? 4) - (order[b.status as keyof typeof order] ?? 4);
    });

  return (
    <>
      <PageIntro
        eyebrow="Submission review"
        title="AI draft first, tutor judgement second."
        description="Review uploaded work, adjust the final mark if needed, and publish feedback back to the student and parent views."
      />

      <section className="grid gap-4">
        {reviewQueue.length ? (
          reviewQueue.map((item) => (
            <TutorReviewCard
              key={item.id}
              submissionId={item.id}
              student={item.student}
              title={item.title}
              subject={item.subject}
              status={item.status}
              notes={item.notes}
              autoMark={item.autoMark}
              autoGrade={item.autoGrade}
              autoFeedback={item.autoFeedback}
              tutorMark={item.tutorMark}
              tutorGrade={item.tutorGrade}
              tutorFeedback={item.tutorFeedback}
              draftSource={item.draftSource}
              reviewLabels={item.reviewLabels}
              autoConfidence={item.autoConfidence}
            />
          ))
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>No submissions to review yet</CardTitle>
              <CardDescription>The live review queue will populate as soon as students upload work.</CardDescription>
            </CardHeader>
          </Card>
        )}
      </section>
    </>
  );
}
