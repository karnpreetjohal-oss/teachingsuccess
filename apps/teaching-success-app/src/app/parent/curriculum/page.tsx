import { PageIntro } from "@/components/page-intro";
import { getParentDataBundle, labelStudent } from "@/lib/server/parent-data";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function statusVariant(status: string) {
  if (status === "secure") return "green";
  if (status === "developing") return "amber";
  return "red";
}

function statusLabel(status: string) {
  if (status === "secure") return "Secure";
  if (status === "developing") return "Developing";
  return "Needs focus";
}

export default async function ParentCurriculumPage() {
  const { linkedStudents, mastery } = await getParentDataBundle({ mastery: true });
  const studentsById = new Map(linkedStudents.map((student) => [student.id, student]));

  return (
    <>
      <PageIntro
        eyebrow="Curriculum progress"
        title="Traffic-light progress by subject and unit."
        description="See the most recent curriculum objectives recorded for each linked child."
      />

      <Card>
        <CardHeader>
          <CardTitle>Current curriculum view</CardTitle>
          <CardDescription>Recent mastery updates grouped by student, subject, and objective.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {mastery.length ? (
            mastery.map((row) => (
              <div
                key={`${row.student_id}-${row.curriculum_objective?.objective_id || "objective"}-${row.updated_at}`}
                className="grid gap-3 rounded-[26px] border border-brand-line bg-white px-4 py-4 md:grid-cols-[.45fr_1fr_.3fr] md:items-center"
              >
                <div>
                  <p className="font-semibold text-brand-ink">{labelStudent(studentsById.get(row.student_id))}</p>
                  <p className="text-sm text-brand-muted">{row.curriculum_objective?.subject || "Subject"}</p>
                </div>
                <p className="text-sm text-brand-muted">{row.curriculum_objective?.objective_text || "Curriculum objective"}</p>
                <Badge variant={statusVariant(row.rating) as "green" | "amber" | "red"} className="w-fit">
                  {statusLabel(row.rating)}
                </Badge>
              </div>
            ))
          ) : (
            <div className="rounded-[26px] border border-brand-line bg-white px-4 py-4 text-sm leading-7 text-brand-muted">
              No curriculum mastery has been recorded yet for linked students.
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
