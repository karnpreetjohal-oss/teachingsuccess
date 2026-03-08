import { PageIntro } from "@/components/page-intro";
import { StudentAccessCodeManager } from "@/components/student-access-code-manager";
import { getTutorDataBundle, labelTutorParent, labelTutorStudent } from "@/lib/server/tutor-data";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function TutorStudentsPage() {
  const { assignments, reviews, parentLinks, accessCodes } = await getTutorDataBundle({
    assignments: true,
    reviews: true,
    parentLinks: true,
    accessCodes: true
  });

  const studentMap = new Map<
    string,
    {
      id: string;
      label: string;
      yearGroup: string | null;
      subjects: Set<string>;
      parentLabels: Set<string>;
      reviewCount: number;
      accessCodes: typeof accessCodes;
    }
  >();

  assignments.forEach((assignment) => {
    const existing = studentMap.get(assignment.student_id) || {
      id: assignment.student_id,
      label: labelTutorStudent(assignment.student),
      yearGroup: assignment.student?.year_group || null,
      subjects: new Set<string>(),
      parentLabels: new Set<string>(),
      reviewCount: 0,
      accessCodes: []
    };
    existing.subjects.add(assignment.subject);
    studentMap.set(assignment.student_id, existing);
  });

  reviews.forEach((review) => {
    const existing = studentMap.get(review.student_id) || {
      id: review.student_id,
      label: labelTutorStudent(review.student),
      yearGroup: review.student?.year_group || null,
      subjects: new Set<string>(),
      parentLabels: new Set<string>(),
      reviewCount: 0,
      accessCodes: []
    };
    existing.reviewCount += 1;
    studentMap.set(review.student_id, existing);
  });

  parentLinks.forEach((link) => {
    const existing = studentMap.get(link.student_id) || {
      id: link.student_id,
      label: labelTutorStudent(link.student),
      yearGroup: link.student?.year_group || null,
      subjects: new Set<string>(),
      parentLabels: new Set<string>(),
      reviewCount: 0,
      accessCodes: []
    };
    existing.parentLabels.add(labelTutorParent(link.parent));
    studentMap.set(link.student_id, existing);
  });

  accessCodes.forEach((code) => {
    const existing = studentMap.get(code.student_id) || {
      id: code.student_id,
      label: "Student",
      yearGroup: null,
      subjects: new Set<string>(),
      parentLabels: new Set<string>(),
      reviewCount: 0,
      accessCodes: []
    };
    existing.accessCodes = [...existing.accessCodes, code];
    studentMap.set(code.student_id, existing);
  });

  const students = [...studentMap.values()].sort((a, b) => a.label.localeCompare(b.label));
  const activeCodes = accessCodes.filter((code) => code.is_active).length;
  const usedCodes = accessCodes.filter((code) => Boolean(code.last_used_at)).length;
  const linkedParents = new Set(parentLinks.map((link) => link.parent?.id).filter(Boolean)).size;

  return (
    <>
      <PageIntro
        eyebrow="Student manager"
        title="Student records and PIN access."
        description="Manage the live student list, check linked parents, and issue or rotate PIN codes for app access."
      />

      <section className="grid gap-4 lg:grid-cols-[.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>Access overview</CardTitle>
            <CardDescription>These numbers update from the current student and parent records already linked to your account.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm leading-7 text-brand-muted">
            <div className="rounded-2xl border border-brand-line bg-brand-surface px-4 py-4">
              Active PIN codes: <span className="font-semibold text-brand-ink">{activeCodes}</span>
            </div>
            <div className="rounded-2xl border border-brand-line bg-brand-surface px-4 py-4">
              Codes used recently: <span className="font-semibold text-brand-ink">{usedCodes}</span>
            </div>
            <div className="rounded-2xl border border-brand-line bg-brand-surface px-4 py-4">
              Linked parents: <span className="font-semibold text-brand-ink">{linkedParents}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current students</CardTitle>
            <CardDescription>Operational view first: year, subjects, exam board, and linked parent.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {students.length ? (
              students.map((student) => (
                <div key={student.id} className="rounded-[26px] border border-brand-line bg-white px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-semibold text-brand-ink">{student.label}</p>
                    <Badge variant="gold">{student.yearGroup || "Year group not set"}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-brand-muted">
                    {student.subjects.size ? [...student.subjects].sort().join(", ") : "No subjects recorded yet"}
                  </p>
                  <p className="mt-1 text-sm text-brand-muted">
                    Parent: {student.parentLabels.size ? [...student.parentLabels].join(", ") : "No linked parent"}
                  </p>
                  <p className="mt-1 text-sm text-brand-muted">
                    Reviews published: {student.reviewCount}
                  </p>
                  <div className="mt-4">
                    <StudentAccessCodeManager
                      studentId={student.id}
                      studentLabel={student.label}
                      accessCodes={student.accessCodes}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[26px] border border-brand-line bg-white px-4 py-4 text-sm leading-7 text-brand-muted">
                No tutor-linked students are visible yet.
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </>
  );
}
