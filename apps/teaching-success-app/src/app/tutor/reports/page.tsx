import { PageIntro } from "@/components/page-intro";
import { getTutorDataBundle, labelTutorStudent } from "@/lib/server/tutor-data";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function TutorReportsPage() {
  const { assignments, reviews } = await getTutorDataBundle({ assignments: true, reviews: true });
  const students = new Map<
    string,
    {
      name: string;
      latestSubmissionAt: string | null;
      latestMarkedTitle: string | null;
      latestReviewAt: string | null;
      latestReviewLabel: string | null;
    }
  >();

  assignments.forEach((assignment) => {
    const latestSubmission = [...assignment.submissions]
      .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())[0] ?? null;
    const existing = students.get(assignment.student_id) || {
      name: labelTutorStudent(assignment.student),
      latestSubmissionAt: null,
      latestMarkedTitle: null,
      latestReviewAt: null,
      latestReviewLabel: null
    };

    if (latestSubmission && (!existing.latestSubmissionAt || new Date(latestSubmission.submitted_at) > new Date(existing.latestSubmissionAt))) {
      existing.latestSubmissionAt = latestSubmission.submitted_at;
      existing.latestMarkedTitle = assignment.title;
    }

    students.set(assignment.student_id, existing);
  });

  reviews.forEach((review) => {
    const existing = students.get(review.student_id) || {
      name: labelTutorStudent(review.student),
      latestSubmissionAt: null,
      latestMarkedTitle: null,
      latestReviewAt: null,
      latestReviewLabel: null
    };

    if (!existing.latestReviewAt || new Date(review.created_at) > new Date(existing.latestReviewAt)) {
      existing.latestReviewAt = review.created_at;
      existing.latestReviewLabel = review.period_label || "Published review";
    }

    students.set(review.student_id, existing);
  });

  const formatDate = (value: string | null) =>
    value
      ? new Intl.DateTimeFormat("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric"
        }).format(new Date(value))
      : "No date yet";

  const needsReport = [...students.values()]
    .filter((student) => {
      if (!student.latestSubmissionAt) return false;
      if (!student.latestReviewAt) return true;
      return new Date(student.latestSubmissionAt) > new Date(student.latestReviewAt);
    })
    .sort((a, b) => new Date(b.latestSubmissionAt || 0).getTime() - new Date(a.latestSubmissionAt || 0).getTime());

  return (
    <>
      <PageIntro
        eyebrow="Reports and trends"
        title="Track published reviews and who needs the next one."
        description="Use recent submissions and existing review history to keep parent reporting up to date."
      />

      <section className="grid gap-4 lg:grid-cols-[.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>Students needing the next review</CardTitle>
            <CardDescription>Students with recent work submitted after their latest published review.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {needsReport.length ? (
              needsReport.map((student) => (
                <div key={`${student.name}-${student.latestSubmissionAt}`} className="rounded-[24px] border border-brand-line bg-brand-surface px-4 py-4 text-sm leading-7 text-brand-ink">
                  <p className="font-semibold">{student.name}</p>
                  <p className="mt-1">Latest work: {student.latestMarkedTitle || "Recent submission"} on {formatDate(student.latestSubmissionAt)}</p>
                  <p className="mt-1 text-brand-muted">
                    Last review: {student.latestReviewLabel ? `${student.latestReviewLabel} on ${formatDate(student.latestReviewAt)}` : "No published review yet"}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-[24px] border border-brand-line bg-brand-surface px-4 py-4 text-sm leading-7 text-brand-ink">
                Everyone with recent work already has a published review.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Published reviews</CardTitle>
            <CardDescription>Latest parent-facing progress summaries already in the system.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {reviews.length ? (
              reviews.map((review) => (
                <div key={review.id} className="rounded-[26px] border border-brand-line bg-white px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-semibold text-brand-ink">{labelTutorStudent(review.student)}</p>
                    <Badge variant="amber">{review.period_label || "Published review"}</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-7 text-brand-muted">
                    Predicted {review.predicted_grade}
                    {review.confidence_pct !== null ? ` • ${Number(review.confidence_pct)}% confidence` : ""}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-brand-muted">
                    {review.action_plan || review.needs_help || review.doing_well || "No summary added yet."}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-[26px] border border-brand-line bg-white px-4 py-4 text-sm leading-7 text-brand-muted">
                No tutor reviews have been published yet.
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </>
  );
}
