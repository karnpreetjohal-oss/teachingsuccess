import { NextResponse } from "next/server";

import { getStudentSessionFromCookies } from "@/lib/auth/student-session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  createQuickUploadAssignment,
  ensureSubmission,
  markAssignmentSubmitted,
  storeSubmissionFiles,
  triggerSubmissionOcr
} from "@/lib/server/student-upload";

export async function POST(request: Request) {
  const session = await getStudentSessionFromCookies();
  if (!session) {
    return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  }

  try {
    const supabase = createSupabaseAdminClient();
    const formData = await request.formData();
    const assignmentIdRaw = String(formData.get("assignmentId") || "").trim();
    const mode = String(formData.get("mode") || "assignment").trim();
    const notes = String(formData.get("notes") || "").trim();
    const subject = String(formData.get("subject") || "General").trim();
    const topic = String(formData.get("topic") || "").trim();
    const title = String(formData.get("title") || "").trim();
    const markingMode = String(formData.get("markingMode") || "generic_completion_review").trim();
    const files = formData
      .getAll("photos")
      .filter((value): value is File => value instanceof File && value.size > 0);

    let assignmentId = assignmentIdRaw;
    let assignmentTitle = "";

    if (mode === "quick") {
      const created = await createQuickUploadAssignment(supabase, session.studentId, {
        subject,
        topic,
        title,
        notes,
        markingMode
      });
      assignmentId = created.id;
      assignmentTitle = created.title;
    } else {
      if (!assignmentId) {
        return NextResponse.json({ error: "Choose an assignment first." }, { status: 400 });
      }

      const { data: assignment, error } = await supabase
        .from("assignments")
        .select("id,title")
        .eq("id", assignmentId)
        .eq("student_id", session.studentId)
        .maybeSingle();

      if (error || !assignment) {
        return NextResponse.json({ error: "Assignment not found." }, { status: 404 });
      }
      assignmentTitle = assignment.title;
    }

    const submissionId = await ensureSubmission(supabase, assignmentId, session.studentId, notes);
    await storeSubmissionFiles(supabase, session.studentId, assignmentId, submissionId, files);
    await markAssignmentSubmitted(supabase, assignmentId, session.studentId);

    let ocrTriggered = false;
    let ocrError: string | null = null;
    try {
      await triggerSubmissionOcr(supabase, submissionId);
      ocrTriggered = true;
    } catch (error) {
      ocrError = error instanceof Error ? error.message : "OCR trigger failed";
    }

    return NextResponse.json({
      ok: true,
      assignmentId,
      assignmentTitle,
      submissionId,
      ocrTriggered,
      ocrError
    });
  } catch (error) {
    console.error("student submission upload failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed." },
      { status: 500 }
    );
  }
}
