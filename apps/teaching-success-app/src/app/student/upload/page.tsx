import { PageIntro } from "@/components/page-intro";
import { StudentUploadForm } from "@/components/student-upload-form";
import { getStudentAssignments } from "@/lib/server/student-data";

export default async function StudentUploadPage({
  searchParams,
}: {
  searchParams?: { assignmentId?: string };
}) {
  const assignments = await getStudentAssignments();
  const assignmentOptions = assignments
    .filter((assignment) => assignment.status === "assigned" || assignment.status === "submitted")
    .map((assignment) => ({
      id: assignment.id,
      title: assignment.title,
      subject: assignment.subject,
      status: assignment.status,
      dueDate: assignment.due_date
    }));
  const initialAssignmentId =
    typeof searchParams?.assignmentId === "string" ? searchParams.assignmentId : undefined;

  return (
    <>
      <PageIntro
        eyebrow="Quick upload"
        title={assignmentOptions.length ? "Submit assigned work or upload a fresh piece." : "Quick upload a fresh piece of work."}
        description={
          assignmentOptions.length
            ? "Pick one of your live assignments below, or switch to quick upload for extra workbook or homework practice."
            : "No live assignment is waiting, so this screen starts on quick upload and creates a tracked task automatically."
        }
      />

      <StudentUploadForm assignments={assignmentOptions} initialAssignmentId={initialAssignmentId} />
    </>
  );
}
