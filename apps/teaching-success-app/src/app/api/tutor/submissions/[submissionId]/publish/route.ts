import { NextRequest, NextResponse } from "next/server";

import { getAuthenticatedSupabaseProfile } from "@/lib/server/account-session";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  const auth = await getAuthenticatedSupabaseProfile();
  if (!auth || auth.profile.role !== "tutor") {
    return NextResponse.json({ error: "Please sign in as a tutor." }, { status: 401 });
  }

  try {
    const { submissionId } = await params;
    const body = await request.json();
    const mode = String(body?.mode || "manual").trim();

    const { data: submission, error: loadError } = await auth.supabase
      .from("submissions")
      .select(`
        id,
        assignment_id,
        mark,
        grade,
        tutor_feedback,
        auto_mark,
        auto_grade,
        auto_feedback,
        auto_result,
        assignments!inner (
          id,
          tutor_id
        )
      `)
      .eq("id", submissionId)
      .maybeSingle();

    if (loadError || !submission) {
      return NextResponse.json({ error: "Submission not found." }, { status: 404 });
    }

    const assignment = Array.isArray(submission.assignments) ? submission.assignments[0] : submission.assignments;
    if (!assignment || assignment.tutor_id !== auth.profile.id) {
      return NextResponse.json({ error: "You do not have access to this submission." }, { status: 403 });
    }

    if (mode === "publish_auto") {
      if (submission.auto_mark === null || submission.auto_mark === undefined) {
        return NextResponse.json({ error: "No auto result is available yet." }, { status: 400 });
      }

      const { error: submissionError } = await auth.supabase
        .from("submissions")
        .update({
          mark: submission.auto_mark,
          grade: submission.auto_grade || null,
          tutor_feedback: submission.auto_feedback || "Auto result accepted as final.",
          tutor_result: submission.auto_result,
          graded_at: new Date().toISOString()
        })
        .eq("id", submissionId);

      if (submissionError) {
        return NextResponse.json({ error: submissionError.message }, { status: 400 });
      }
    } else {
      const markRaw = String(body?.mark ?? "").trim();
      const grade = String(body?.grade || "").trim();
      const feedback = String(body?.feedback || "").trim();
      const numericMark = Number(markRaw);

      if (markRaw !== "" && (!Number.isFinite(numericMark) || numericMark < 0 || numericMark > 100)) {
        return NextResponse.json({ error: "Mark must be between 0 and 100." }, { status: 400 });
      }

      const mark = markRaw === "" ? null : numericMark;

      const { error: submissionError } = await auth.supabase
        .from("submissions")
        .update({
          mark,
          grade: grade || null,
          tutor_feedback: feedback || null,
          tutor_result: {
            mark,
            grade: grade || null,
            feedback: feedback || null,
            updated_by: auth.profile.id,
            published_at: new Date().toISOString(),
            source: "manual"
          },
          graded_at: new Date().toISOString()
        })
        .eq("id", submissionId);

      if (submissionError) {
        return NextResponse.json({ error: submissionError.message }, { status: 400 });
      }
    }

    const { error: assignmentError } = await auth.supabase
      .from("assignments")
      .update({ status: "marked" })
      .eq("id", assignment.id)
      .eq("tutor_id", auth.profile.id);

    if (assignmentError) {
      return NextResponse.json({ error: assignmentError.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("submission publish failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not publish result." },
      { status: 500 }
    );
  }
}
