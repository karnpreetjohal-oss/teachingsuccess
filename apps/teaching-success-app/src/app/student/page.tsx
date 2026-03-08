import Link from "next/link";

import { PageIntro } from "@/components/page-intro";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getStudentDashboardData } from "@/lib/server/student-data";

function formatDueLabel(value: string | null) {
  if (!value) return "No due date set";
  const date = new Date(value);
  return `Due ${new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(date)}`;
}

function assignmentTone(status: string) {
  if (status === "completed") return "green";
  if (status === "submitted") return "amber";
  if (status === "marked") return "blue";
  return "gold";
}

function scoreTone(mark: number | null, gradedAt: string | null | undefined) {
  if (!gradedAt) return "amber";
  if (mark === null) return "amber";
  if (mark >= 80) return "green";
  if (mark >= 60) return "blue";
  return "red";
}

export default async function StudentHomePage() {
  const { profile, currentAssignment, recentSubmission, latestReview, stats } = await getStudentDashboardData();
  const firstName = String(profile.full_name || "Student").trim().split(/\s+/)[0] || "Student";
  const recentScore =
    recentSubmission?.auto_mark === null || recentSubmission?.auto_mark === undefined
      ? null
      : Number(recentSubmission.auto_mark);

  return (
    <>
      <PageIntro
        eyebrow="Student app"
        title={`Hi ${firstName}. Ready for today's work?`}
        description={
          currentAssignment
            ? "Your next task is already loaded here. Open the instructions or send photos straight away."
            : "No live assignment is waiting right now, but you can still quick-upload work for marking."
        }
        actions={
          <>
            <Link href="/student/upload" className={buttonVariants({ size: "lg" })}>
              Quick upload
            </Link>
            {currentAssignment ? (
              <Link
                href={`/student/assignments/${currentAssignment.id}`}
                className={buttonVariants({ variant: "outline", size: "lg" })}
              >
                Open assignment
              </Link>
            ) : null}
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        {stats.map((item) => (
          <StatCard
            key={item.label}
            label={item.label}
            value={item.value}
            helper={item.helper}
            tone={item.tone as "blue" | "green" | "amber" | "red"}
          />
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
        <Card>
          <CardHeader>
            {currentAssignment ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="blue">{currentAssignment.subject}</Badge>
                  {currentAssignment.year_group ? <Badge variant="gold">Year {currentAssignment.year_group}</Badge> : null}
                  {currentAssignment.exam_board ? <Badge variant="neutral">{currentAssignment.exam_board}</Badge> : null}
                  <Badge variant={assignmentTone(currentAssignment.status) as "green" | "amber" | "blue" | "gold"}>
                    {currentAssignment.status}
                  </Badge>
                </div>
                <CardTitle>{currentAssignment.title}</CardTitle>
                <CardDescription>{formatDueLabel(currentAssignment.due_date)}</CardDescription>
              </>
            ) : (
              <>
                <Badge variant="amber" className="w-fit">
                  No live assignment
                </Badge>
                <CardTitle>Quick upload is the next action.</CardTitle>
                <CardDescription>Your tutor has not assigned a new task yet, so this screen falls back to a direct upload path.</CardDescription>
              </>
            )}
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="rounded-[24px] bg-brand-surface p-4 text-sm leading-7 text-brand-muted">
              {currentAssignment?.description ||
                "Upload a clean photo set, keep all working visible, and add a short note if there was a question you found difficult."}
            </div>
            {currentAssignment?.submissions?.length ? (
              <div className="rounded-[24px] border border-brand-line bg-white px-4 py-4 text-sm leading-7 text-brand-muted">
                This task already has {currentAssignment.submissions.length} submission
                {currentAssignment.submissions.length === 1 ? "" : "s"} attached. You can upload a cleaner set or open the latest result.
              </div>
            ) : null}
            <div className="flex flex-wrap gap-3">
              {currentAssignment ? (
                <Link href={`/student/assignments/${currentAssignment.id}`} className={buttonVariants()}>
                  View instructions
                </Link>
              ) : null}
              <Link
                href={currentAssignment ? `/student/upload?assignmentId=${currentAssignment.id}` : "/student/upload"}
                className={buttonVariants({ variant: "secondary" })}
              >
                Upload work now
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Badge
              variant={
                scoreTone(recentScore, recentSubmission?.auto_graded_at) as "green" | "amber" | "blue" | "red"
              }
              className="w-fit"
            >
              {recentSubmission?.auto_graded_at
                ? recentScore === null
                  ? "Marked"
                  : `${recentScore}%${recentSubmission.auto_grade ? ` • ${recentSubmission.auto_grade}` : ""}`
                : recentSubmission
                  ? "Marking in progress"
                  : "No feedback yet"}
            </Badge>
            <CardTitle>
              {recentSubmission ? recentSubmission.assignment.title : latestReview ? "Latest tutor review" : "Feedback will appear here"}
            </CardTitle>
            <CardDescription>
              {recentSubmission
                ? recentSubmission.auto_graded_at
                  ? "Open the latest result to see the full draft mark and next steps."
                  : "OCR and marking are still running on the latest submission."
                : latestReview
                  ? latestReview.period_label || "Most recent progress review"
                  : "As soon as work is uploaded and marked, the latest feedback card will update here."}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm leading-7 text-brand-muted">
            {recentSubmission ? (
              <>
                <div className="rounded-2xl border border-brand-line bg-white px-4 py-4 text-brand-ink">
                  {recentSubmission.auto_feedback || recentSubmission.tutor_feedback || "Your latest submission is processing now."}
                </div>
                <Link
                  href={`/student/results/${recentSubmission.id}`}
                  className={buttonVariants({ variant: "outline", className: "mt-1" })}
                >
                  {recentSubmission.auto_graded_at ? "Open results" : "Check marking status"}
                </Link>
              </>
            ) : latestReview ? (
              <>
                <div className="rounded-2xl border border-brand-green/20 bg-brand-green/8 px-4 py-3 text-brand-ink">
                  <p className="font-semibold">Doing well</p>
                  <p className="mt-1">{latestReview.doing_well || "No strengths summary yet."}</p>
                </div>
                <div className="rounded-2xl border border-brand-amber/20 bg-brand-amber/10 px-4 py-3 text-brand-ink">
                  <p className="font-semibold">Current focus</p>
                  <p className="mt-1">{latestReview.action_plan || latestReview.needs_help || "Tutor targets will show here."}</p>
                </div>
              <Link href="/student/progress" className={buttonVariants({ variant: "outline", className: "mt-1" })}>
                  Open progress
                </Link>
              </>
            ) : (
              <div className="rounded-2xl border border-brand-line bg-white px-4 py-4 text-brand-ink">
                Your latest marked work or tutor review will appear here as soon as it is ready.
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {latestReview ? (
        <section>
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="gold">Latest tutor review</Badge>
                <Badge variant="blue">{latestReview.predicted_grade}</Badge>
                {latestReview.confidence_pct !== null ? (
                  <Badge variant="neutral">{Number(latestReview.confidence_pct)}% confidence</Badge>
                ) : null}
              </div>
              <CardTitle>{latestReview.period_label || "Current review summary"}</CardTitle>
              <CardDescription>Keep the student-facing summary short enough to scan in under a minute.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-brand-green/20 bg-brand-green/8 px-4 py-4 text-sm leading-7 text-brand-ink">
                <p className="font-semibold">Doing well</p>
                <p className="mt-1">{latestReview.doing_well || "No strength note yet."}</p>
              </div>
              <div className="rounded-2xl border border-brand-amber/20 bg-brand-amber/10 px-4 py-4 text-sm leading-7 text-brand-ink">
                <p className="font-semibold">Needs help</p>
                <p className="mt-1">{latestReview.needs_help || "No focus area recorded."}</p>
              </div>
              <div className="rounded-2xl border border-brand-line bg-white px-4 py-4 text-sm leading-7 text-brand-ink">
                <p className="font-semibold">Action plan</p>
                <p className="mt-1">{latestReview.action_plan || "Next steps will be added by the tutor."}</p>
              </div>
            </CardContent>
          </Card>
        </section>
      ) : null}
    </>
  );
}
