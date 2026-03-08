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
    .filter((assignment) => assignment.status !== "completed")
    .map((assignment) => ({
      id: assignment.id,
      title: assignment.title,
      subject: assignment.subject,
      status: assignment.status
    }));
  const initialAssignmentId =
    typeof searchParams?.assignmentId === "string" ? searchParams.assignmentId : undefined;

  return (
    <>
      <PageIntro
        eyebrow="Quick upload"
        title={assignmentOptions.length ? "Take photos, check them, submit." : "Quick upload a fresh piece of work."}
        description={
          assignmentOptions.length
            ? "Choose the assigned task or switch to quick upload. Photos are stored immediately and OCR marking starts in the background."
            : "No live assignment is waiting, so this screen defaults to the quick-upload path and creates a tracked assignment automatically."
        }
      />

      <StudentUploadForm assignments={assignmentOptions} initialAssignmentId={initialAssignmentId} />
    </>
  );
}
