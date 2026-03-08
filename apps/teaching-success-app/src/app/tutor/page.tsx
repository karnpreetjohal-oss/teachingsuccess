import Link from "next/link";

import { PageIntro } from "@/components/page-intro";
import { StatCard } from "@/components/stat-card";
import {
  getTutorDataBundle,
  getTutorSubmissionScore,
  getTutorSubmissionSummary,
  labelTutorStudent
} from "@/lib/server/tutor-data";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function TutorDashboardPage() {
  const { assignments, reviews } = await getTutorDataBundle({
    assignments: true,
    reviews: true
  });

  const queue = assignments
    .map((assignment) => {
      const latestSubmission = [...assignment.submissions]
        .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())[0] ?? null;
      const score = latestSubmission ? getTutorSubmissionScore(latestSubmission) : null;
      const state = !latestSubmission
        ? "Awaiting upload"
        : latestSubmission.ocr_processing
          ? "Pending OCR"
          : latestSubmission.mark !== null || latestSubmission.tutor_feedback
            ? "Published"
            : latestSubmission.auto_graded_at
              ? "AI draft ready"
              : "Awaiting mark";

      return {
        id: assignment.id,
        student: labelTutorStudent(assignment.student),
        title: assignment.title,
        state,
        score,
        submittedAt: latestSubmission?.submitted_at || assignment.created_at
      };
    })
    .filter((item) => item.state !== "Awaiting upload")
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

  const metrics = [
    {
      label: "Active students",
      value: String(new Set(assignments.map((assignment) => assignment.student_id)).size),
      helper: "students with tutor-owned assignments",
      tone: "blue"
    },
    {
      label: "Uploads waiting",
      value: String(queue.filter((item) => item.state === "Pending OCR" || item.state === "Awaiting mark").length),
      helper: "submitted and not ready yet",
      tone: "amber"
    },
    {
      label: "AI drafts ready",
      value: String(queue.filter((item) => item.state === "AI draft ready").length),
      helper: "ready for tutor review",
      tone: "green"
    },
    {
      label: "Reports published",
      value: String(reviews.length),
      helper: "student progress reviews created",
      tone: "red"
    }
  ];

  return (
    <>
      <PageIntro
        eyebrow="Tutor dashboard"
        title="Operational control first."
        description="See uploads waiting for review, draft marks ready to publish, and recent feedback activity."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((item) => (
          <StatCard key={item.label} label={item.label} value={item.value} helper={item.helper} tone={item.tone as "blue" | "green" | "amber" | "red"} />
        ))}
      </section>

      <section className="flex flex-wrap gap-3">
        <Link href="/tutor/assignments/new" className={buttonVariants({ size: "lg" })}>
          Create assignment
        </Link>
        <Link href="/tutor/submissions" className={buttonVariants({ variant: "outline", size: "lg" })}>
          Open review queue
        </Link>
        <Link href="/tutor/students" className={buttonVariants({ variant: "ghost", size: "lg" })}>
          Manage student access
        </Link>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Today's queue</CardTitle>
          <CardDescription>Latest uploaded work ordered by what needs action first.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {queue.length ? (
            queue.slice(0, 6).map((item) => (
              <div key={item.id} className="grid gap-3 rounded-[26px] border border-brand-line bg-white px-4 py-4 md:grid-cols-[.28fr_1fr_.3fr] md:items-center">
                <p className="font-semibold text-brand-ink">{item.student}</p>
                <div>
                  <p className="text-sm text-brand-muted">{item.title}</p>
                  <Link href="/tutor/submissions" className="mt-2 inline-flex text-sm font-semibold text-brand-blue">
                    Review submission
                  </Link>
                </div>
                <div className="flex justify-start md:justify-end">
                  <Badge variant={item.state.includes("draft") ? "blue" : item.state.includes("Published") ? "green" : "amber"} className="w-fit">
                    {item.state}
                  </Badge>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-[26px] border border-brand-line bg-white px-4 py-4 text-sm leading-7 text-brand-muted">
              No submission activity yet. As soon as a student uploads work, the review queue will show here.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent feedback activity</CardTitle>
          <CardDescription>Live summaries from the latest reviewed submissions.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {assignments
            .flatMap((assignment) =>
              assignment.submissions.map((submission) => ({
                id: submission.id,
                student: labelTutorStudent(assignment.student),
                title: assignment.title,
                summary: getTutorSubmissionSummary(submission),
                submittedAt: submission.submitted_at
              }))
            )
            .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
            .slice(0, 4)
            .map((item) => (
              <div key={item.id} className="rounded-2xl border border-brand-line bg-brand-surface px-4 py-4 text-sm leading-7 text-brand-ink">
                <p className="font-semibold">{item.student} • {item.title}</p>
                <p className="mt-1">{item.summary}</p>
              </div>
            ))}
          {!assignments.some((assignment) => assignment.submissions.length) ? (
            <div className="rounded-2xl border border-brand-line bg-brand-surface px-4 py-4 text-sm leading-7 text-brand-ink">
              No reviewed submissions yet. Feedback activity will appear here once students start uploading work.
            </div>
          ) : null}
        </CardContent>
      </Card>
    </>
  );
}
