import Link from "next/link";
import { notFound } from "next/navigation";

import { PageIntro } from "@/components/page-intro";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getStudentAssignmentById } from "@/lib/server/student-data";

function formatDueLabel(value: string | null) {
  if (!value) return "No due date set";
  const date = new Date(value);
  return `Due ${new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(date)}`;
}

function statusVariant(status: string) {
  if (status === "completed") return "green";
  if (status === "submitted") return "amber";
  if (status === "marked") return "blue";
  return "gold";
}

export default async function StudentAssignmentPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const assignment = await getStudentAssignmentById(id);
  if (!assignment) {
    notFound();
  }

  const unit = Array.isArray(assignment.curriculum_units) ? assignment.curriculum_units[0] : assignment.curriculum_units;
  const lesson = Array.isArray(assignment.curriculum_lessons) ? assignment.curriculum_lessons[0] : assignment.curriculum_lessons;
  const latestSubmission = [...(assignment.submissions ?? [])]
    .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())[0] ?? null;

  return (
    <>
      <PageIntro
        eyebrow="Assignment view"
        title={assignment.title}
        description="Everything you need for this task is in one place, including instructions, resources, and the upload action."
      />

      <section className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap gap-2">
              <Badge variant="blue">{assignment.subject}</Badge>
              {assignment.year_group ? <Badge variant="gold">Year {assignment.year_group}</Badge> : null}
              {assignment.exam_board ? <Badge variant="neutral">{assignment.exam_board}</Badge> : null}
              <Badge variant={statusVariant(assignment.status) as "green" | "amber" | "blue" | "gold"}>
                {assignment.status}
              </Badge>
            </div>
            <CardTitle>Instructions</CardTitle>
            <CardDescription>
              {formatDueLabel(assignment.due_date)}
              {unit?.unit_title ? ` • Unit: ${unit.unit_title}` : ""}
              {lesson?.lesson_title ? ` • Lesson: ${lesson.lesson_title}` : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm leading-7 text-brand-muted">
            <p>{assignment.description || "No extra instructions were added to this assignment."}</p>
            {assignment.resource_title || assignment.resource_url || assignment.file_url ? (
              <div className="rounded-[24px] border border-brand-line bg-white px-4 py-4">
                <p className="font-semibold text-brand-ink">Linked resource</p>
                <p className="mt-1">
                  {assignment.resource_title || "Assignment resource"}
                </p>
                {assignment.resource_url || assignment.file_url ? (
                  <a
                    href={assignment.resource_url || assignment.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex text-sm font-semibold text-brand-blue"
                  >
                    Open resource
                  </a>
                ) : null}
              </div>
            ) : null}
            <div className="rounded-[24px] bg-brand-surface p-4">
              <p className="font-semibold text-brand-ink">What happens after upload</p>
              <p className="mt-2">
                OCR runs first, then AI creates a draft mark, strengths, mistakes, and next steps. Important submissions can be approved or edited by the tutor.
              </p>
            </div>
            <div className="rounded-[24px] border border-brand-line bg-white px-4 py-4">
              <p className="font-semibold text-brand-ink">Marking mode</p>
              <p className="mt-1">{assignment.marking_mode || "generic_completion_review"}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Next action</CardTitle>
            <CardDescription>Keep the student flow obvious and immediate.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {latestSubmission ? (
              <div className="rounded-[24px] border border-brand-line bg-brand-surface px-4 py-4 text-sm leading-7 text-brand-ink">
                {latestSubmission.auto_graded_at
                  ? "This assignment already has a marked submission. Open the result or upload a corrected attempt."
                  : "This assignment already has a submission attached and is still being marked."}
              </div>
            ) : (
              <div className="rounded-[24px] border border-brand-line bg-brand-surface px-4 py-4 text-sm leading-7 text-brand-ink">
                No submission has been sent for this task yet.
              </div>
            )}
            <Link
              href={`/student/upload?assignmentId=${assignment.id}`}
              className={buttonVariants({ size: "lg", className: "w-full" })}
            >
              {latestSubmission ? "Upload corrected work" : "Upload this work"}
            </Link>
            {latestSubmission ? (
              <Link
                href={`/student/results/${latestSubmission.id}`}
                className={buttonVariants({ variant: "outline", className: "w-full" })}
              >
                {latestSubmission.auto_graded_at ? "Open latest result" : "Check marking status"}
              </Link>
            ) : null}
            <Link href="/student" className={buttonVariants({ variant: "ghost", className: "justify-start px-0 text-brand-blue" })}>
              Back to today's work
            </Link>
          </CardContent>
        </Card>
      </section>
    </>
  );
}
