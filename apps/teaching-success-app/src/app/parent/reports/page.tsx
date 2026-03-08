import { PageIntro } from "@/components/page-intro";
import { getParentDataBundle, getSubmissionScore, labelStudent } from "@/lib/server/parent-data";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ParentReportsPage() {
  const { assignments, reviews } = await getParentDataBundle({
    assignments: true,
    reviews: true
  });

  const subjectSummaryMap = new Map<string, { subject: string; total: number; count: number }>();
  assignments.forEach((assignment) => {
    assignment.submissions.forEach((submission) => {
      const score = getSubmissionScore(submission);
      if (score === null) {
        return;
      }
      const key = `${assignment.student_id}:${assignment.subject}`;
      const current = subjectSummaryMap.get(key) || {
        subject: `${labelStudent(assignment.student)} • ${assignment.subject}`,
        total: 0,
        count: 0
      };
      current.total += score;
      current.count += 1;
      subjectSummaryMap.set(key, current);
    });
  });

  const subjectSummaries = [...subjectSummaryMap.values()]
    .map((entry) => ({
      subject: entry.subject,
      average: Math.round(entry.total / entry.count),
      count: entry.count
    }))
    .sort((a, b) => b.average - a.average)
    .slice(0, 6);

  return (
    <>
      <PageIntro
        eyebrow="Reports and reviews"
        title="Published tutor reviews and subject summaries."
        description="Read the latest review notes alongside subject-level progress across marked work."
      />

      <section className="grid gap-4 lg:grid-cols-[1fr_.95fr]">
        <Card>
          <CardHeader>
            <Badge variant="gold" className="w-fit">
              Latest reviews
            </Badge>
            <CardTitle>Published tutor summaries</CardTitle>
            <CardDescription>Recent review cards for each linked student.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm leading-7 text-brand-muted">
            {reviews.length ? (
              reviews.map((review) => (
                <div key={review.id} className="rounded-[24px] border border-brand-line bg-white p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="blue">{labelStudent(review.student)}</Badge>
                    <Badge variant="gold">{review.predicted_grade}</Badge>
                    {review.confidence_pct !== null ? (
                      <Badge variant="neutral">{Number(review.confidence_pct)}% confidence</Badge>
                    ) : null}
                  </div>
                  <p className="mt-3 font-semibold text-brand-ink">{review.period_label || "Progress review"}</p>
                  <p className="mt-2"><b>Doing well:</b> {review.doing_well || "No strengths summary yet."}</p>
                  <p className="mt-2"><b>Needs support:</b> {review.needs_help || "No support note yet."}</p>
                  <p className="mt-2"><b>Action plan:</b> {review.action_plan || "No action plan published yet."}</p>
                </div>
              ))
            ) : (
              <div className="rounded-[24px] bg-brand-surface p-4">
                No tutor reviews have been published yet for linked students.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Subject summaries</CardTitle>
            <CardDescription>Average performance across recent marked tasks for each subject.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {subjectSummaries.length ? (
              subjectSummaries.map((entry) => (
                <div key={entry.subject} className="rounded-2xl border border-brand-line bg-white px-4 py-4">
                  <p className="font-semibold text-brand-ink">{entry.subject}</p>
                  <p className="mt-1 text-sm leading-7 text-brand-muted">
                    Average mark {entry.average}% across {entry.count} marked task{entry.count === 1 ? "" : "s"}.
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-brand-line bg-white px-4 py-4 text-sm leading-7 text-brand-muted">
                Subject summaries will appear once marked submissions are available.
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </>
  );
}
