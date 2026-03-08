import { PageIntro } from "@/components/page-intro";
import { TutorAssignmentBuilderForm } from "@/components/tutor-assignment-builder-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getTutorDataBundle, labelTutorStudent } from "@/lib/server/tutor-data";

export default async function TutorAssignmentBuilderPage() {
  const { assignments, reviews, parentLinks, accessCodes } = await getTutorDataBundle({
    assignments: true,
    reviews: true,
    parentLinks: true,
    accessCodes: true
  });

  const studentMap = new Map<string, { id: string; label: string; yearGroup: string | null }>();
  assignments.forEach((assignment) => {
    studentMap.set(assignment.student_id, {
      id: assignment.student_id,
      label: labelTutorStudent(assignment.student),
      yearGroup: assignment.student?.year_group || null
    });
  });
  reviews.forEach((review) => {
    studentMap.set(review.student_id, {
      id: review.student_id,
      label: labelTutorStudent(review.student),
      yearGroup: review.student?.year_group || null
    });
  });
  parentLinks.forEach((link) => {
    studentMap.set(link.student_id, {
      id: link.student_id,
      label: labelTutorStudent(link.student),
      yearGroup: link.student?.year_group || null
    });
  });
  accessCodes.forEach((code) => {
    studentMap.set(code.student_id, {
      id: code.student_id,
      label: labelTutorStudent(code.student),
      yearGroup: code.student?.year_group || null
    });
  });

  const students = [...studentMap.values()].sort((a, b) => a.label.localeCompare(b.label));

  return (
    <>
      <PageIntro
        eyebrow="Assignment builder"
        title="Create work and send it straight to a student."
        description="Set the task, subject, curriculum context, and marking setup in one place."
      />

      <TutorAssignmentBuilderForm students={students} />

      <Card>
        <CardHeader>
          <Badge variant="green" className="w-fit">
            Attachments
          </Badge>
          <CardTitle>Add a worksheet file or resource link with the assignment.</CardTitle>
          <CardDescription>Students can open the linked file or URL directly from their assignment screen.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm leading-7 text-brand-muted">Use the file upload and resource fields above to give students the worksheet they need.</CardContent>
      </Card>
    </>
  );
}
