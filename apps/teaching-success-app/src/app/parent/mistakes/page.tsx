import { PageIntro } from "@/components/page-intro";
import {
  getParentDataBundle,
  getSubmissionDetails,
  getSubmissionNextSteps,
  getSubmissionScore,
  getSubmissionSummary,
  labelStudent
} from "@/lib/server/parent-data";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ParentMistakesPage() {
  const { assignments } = await getParentDataBundle({ assignments: true });
  const feedbackItems = assignments
    .flatMap((assignment) =>
      assignment.submissions.map((submission) => ({
        assignment,
        submission,
        score: getSubmissionScore(submission),
        details: getSubmissionDetails(submission),
        nextSteps: getSubmissionNextSteps(submission),
        summary: getSubmissionSummary(submission)
      }))
    )
    .filter((item) => item.score !== null || item.summary !== "Feedback has not been published yet.")
    .sort((a, b) => new Date(b.submission.submitted_at).getTime() - new Date(a.submission.submitted_at).getTime());

  return (
    <>
      <PageIntro
        eyebrow="Mistakes and redos"
        title="See what went wrong and whether it improved."
        description="Review the feedback, common mistakes, and next-step practice attached to each submission."
      />

      <section className="grid gap-4">
        {feedbackItems.length ? (
          feedbackItems.map((item) => (
            <Card key={item.submission.id}>
              <CardHeader className="gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <CardTitle>{item.assignment.title}</CardTitle>
                  <CardDescription>
                    {labelStudent(item.assignment.student)} • {item.assignment.subject}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={item.score !== null && item.score >= 80 ? "green" : "amber"}>
                    {item.score !== null ? `${item.score}%` : "Awaiting score"}
                  </Badge>
                  <Badge variant={item.nextSteps.length ? "amber" : "neutral"}>
                    {item.nextSteps.length ? "Redo steps available" : "Review summary only"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 text-sm leading-7 text-brand-muted">
                <div className="rounded-2xl border border-brand-line bg-white px-4 py-4 text-brand-ink">
                  {item.summary}
                </div>
                {item.details.length ? (
                  <div className="rounded-2xl border border-brand-amber/20 bg-brand-amber/8 px-4 py-4 text-brand-ink">
                    <p className="font-semibold">Key issues spotted</p>
                    <ul className="mt-2 grid gap-2">
                      {item.details.slice(0, 4).map((detail) => (
                        <li key={detail}>{detail}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {item.nextSteps.length ? (
                  <div className="rounded-2xl border border-brand-green/20 bg-brand-green/8 px-4 py-4 text-brand-ink">
                    <p className="font-semibold">Next steps</p>
                    <ul className="mt-2 grid gap-2">
                      {item.nextSteps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-brand-line bg-brand-surface px-4 py-4 text-brand-ink">
                    This submission was published with feedback only and no separate redo checklist.
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>No published feedback yet</CardTitle>
              <CardDescription>As soon as a linked student has marked work, the parent-facing feedback cards will appear here.</CardDescription>
            </CardHeader>
          </Card>
        )}
      </section>
    </>
  );
}
