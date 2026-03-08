import { CreateStudentForm } from "@/components/create-student-form";
import { PageIntro } from "@/components/page-intro";
import { TutorStudentDetailDrawer } from "@/components/tutor-student-detail-drawer";
import { getTutorDataBundle, labelTutorStudent } from "@/lib/server/tutor-data";
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
      parentLinks: Array<(typeof parentLinks)[number]>;
      reviewCount: number;
      accessCodes: typeof accessCodes;
      assignments: Array<{
        id: string;
        title: string;
        subject: string;
        dueDate: string | null;
        status: string;
        latestSubmissionAt: string | null;
        createdAt: string;
      }>;
    }
  >();

  assignments.forEach((assignment) => {
    const existing = studentMap.get(assignment.student_id) || {
      id: assignment.student_id,
      label: labelTutorStudent(assignment.student),
      yearGroup: assignment.student?.year_group || null,
      subjects: new Set<string>(),
      parentLinks: [],
      reviewCount: 0,
      accessCodes: [],
      assignments: []
    };
    existing.subjects.add(assignment.subject);
    const latestSubmissionAt = [...assignment.submissions]
      .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())[0]?.submitted_at || null;
    existing.assignments = [
      ...existing.assignments,
      {
        id: assignment.id,
        title: assignment.title,
        subject: assignment.subject,
        dueDate: assignment.due_date,
        status: assignment.status,
        latestSubmissionAt,
        createdAt: assignment.created_at
      }
    ];
    studentMap.set(assignment.student_id, existing);
  });

  reviews.forEach((review) => {
    const existing = studentMap.get(review.student_id) || {
      id: review.student_id,
      label: labelTutorStudent(review.student),
      yearGroup: review.student?.year_group || null,
      subjects: new Set<string>(),
      parentLinks: [],
      reviewCount: 0,
      accessCodes: [],
      assignments: []
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
      parentLinks: [],
      reviewCount: 0,
      accessCodes: [],
      assignments: []
    };
    existing.parentLinks = [...existing.parentLinks, link];
    studentMap.set(link.student_id, existing);
  });

  accessCodes.forEach((code) => {
    const existing = studentMap.get(code.student_id) || {
      id: code.student_id,
      label: labelTutorStudent(code.student),
      yearGroup: code.student?.year_group || null,
      subjects: new Set<string>(),
      parentLinks: [],
      reviewCount: 0,
      accessCodes: [],
      assignments: []
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
        description="Manage the live student list, create parent access, and issue or rotate PIN codes for app access."
      />

      <section className="grid gap-4 lg:grid-cols-[.95fr_1.05fr]">
        <CreateStudentForm />

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
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle>Current students</CardTitle>
            <CardDescription>Keep this list compact, then open a student when you need full access, parent setup, and recent activity.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {students.length ? (
              students.map((student) => (
                <TutorStudentDetailDrawer
                  key={student.id}
                  studentId={student.id}
                  studentLabel={student.label}
                  yearGroup={student.yearGroup}
                  subjects={[...student.subjects].sort()}
                  reviewCount={student.reviewCount}
                  parentLinks={student.parentLinks}
                  accessCodes={student.accessCodes}
                  assignments={student.assignments}
                />
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
