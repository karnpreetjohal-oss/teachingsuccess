import Link from "next/link";

import { PageIntro } from "@/components/page-intro";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getStudentAssignments } from "@/lib/server/student-data";

function badgeVariant(status: string) {
  if (status === "Review complete") return "green";
  if (status === "Needs redo") return "red";
  return "amber";
}

export default async function StudentPracticePage() {
  const assignments = await getStudentAssignments();
  const followUps = assignments
    .flatMap((assignment) =>
      (assignment.submissions ?? []).map((submission) => {
        const mark =
          submission.auto_mark === null || submission.auto_mark === undefined
            ? null
            : Number(submission.auto_mark);
        const status =
          submission.auto_graded_at && mark !== null
            ? mark >= 80
              ? "Review complete"
              : "Needs redo"
            : "Awaiting mark";

        return {
          assignmentId: assignment.id,
          submissionId: submission.id,
          title: assignment.title,
          subject: assignment.subject,
          summary:
            submission.tutor_feedback ||
            submission.auto_feedback ||
            assignment.description ||
            "Open the latest feedback, then upload a corrected attempt if needed.",
          status,
          mark
        };
      })
    )
    .sort((a, b) => {
      if (a.status === b.status) return 0;
      if (a.status === "Needs redo") return -1;
      if (b.status === "Needs redo") return 1;
      if (a.status === "Awaiting mark") return -1;
      if (b.status === "Awaiting mark") return 1;
      return 0;
    });

  return (
    <>
      <PageIntro
        eyebrow="Redo and follow-up tasks"
        title="Follow-up practice from your latest feedback."
        description="Use these cards to see what needs another go, open the latest feedback, and upload a corrected attempt."
      />

      <section className="grid gap-4">
        {followUps.length ? (
          followUps.map((task) => (
            <Card key={task.submissionId}>
              <CardHeader className="gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <CardTitle>{task.title}</CardTitle>
                  <CardDescription>{task.summary}</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={badgeVariant(task.status) as "green" | "red" | "amber"}>{task.status}</Badge>
                  <Badge variant="blue">{task.subject}</Badge>
                  {task.mark !== null ? <Badge variant="neutral">{task.mark}%</Badge> : null}
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Link href={`/student/results/${task.submissionId}`} className={buttonVariants()}>
                  Open feedback
                </Link>
                <Link
                  href={`/student/upload?assignmentId=${task.assignmentId}`}
                  className={buttonVariants({ variant: "outline" })}
                >
                  Upload corrected work
                </Link>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>No follow-up items yet</CardTitle>
              <CardDescription>New practice items will appear here after work is marked or feedback is published.</CardDescription>
            </CardHeader>
          </Card>
        )}
      </section>
    </>
  );
}
