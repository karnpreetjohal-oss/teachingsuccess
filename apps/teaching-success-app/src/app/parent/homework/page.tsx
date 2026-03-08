import { PageIntro } from "@/components/page-intro";
import { getParentDataBundle, getSubmissionScore, labelStudent } from "@/lib/server/parent-data";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function statusVariant(status: string) {
  if (status === "marked" || status === "completed") return "green";
  if (status === "submitted") return "amber";
  return "blue";
}

function formatDue(value: string | null) {
  if (!value) return "No due date set";
  return `Due ${new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(value))}`;
}

export default async function ParentHomeworkPage() {
  const { assignments } = await getParentDataBundle({ assignments: true });

  return (
    <>
      <PageIntro
        eyebrow="Homework tracker"
        title="Assigned, submitted, marked, and redone."
        description="A clear status view of every task across your linked children."
      />

      <Card>
        <CardHeader>
          <CardTitle>Homework status</CardTitle>
          <CardDescription>Latest visible status for each assignment, including due dates and marks where available.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {assignments.length ? (
            assignments.map((assignment) => {
              const latestSubmission = [...(assignment.submissions ?? [])]
                .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())[0] ?? null;
              const score = latestSubmission ? getSubmissionScore(latestSubmission) : null;
              const nextLabel =
                assignment.status === "assigned"
                  ? formatDue(assignment.due_date)
                  : latestSubmission && score !== null
                    ? `Latest score ${score}%`
                    : latestSubmission && latestSubmission.ocr_processing
                      ? "Awaiting OCR"
                      : latestSubmission
                        ? "Awaiting mark"
                        : "Waiting for submission";

              return (
                <div key={assignment.id} className="grid gap-3 rounded-[26px] border border-brand-line bg-white px-4 py-4 md:grid-cols-[1.1fr_.4fr_.45fr] md:items-center">
                  <div>
                    <p className="font-semibold text-brand-ink">{assignment.title}</p>
                    <p className="text-sm text-brand-muted">
                      {labelStudent(assignment.student)} • {assignment.subject}
                    </p>
                  </div>
                  <Badge variant={statusVariant(assignment.status) as "green" | "amber" | "blue"} className="w-fit">
                    {assignment.status}
                  </Badge>
                  <p className="text-sm text-brand-muted">{nextLabel}</p>
                </div>
              );
            })
          ) : (
            <div className="rounded-[26px] border border-brand-line bg-white px-4 py-4 text-sm leading-7 text-brand-muted">
              No assignments are visible yet. Once a linked student receives work, this tracker will show its status here.
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
