import { redirect } from "next/navigation";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStudentSessionFromCookies } from "@/lib/auth/student-session";

const ASSIGNMENT_FILES_BUCKET = "assignment-files";

type AssignmentRow = {
  id: string;
  title: string;
  subject: string;
  description: string | null;
  due_date: string | null;
  status: string;
  year_group: number | null;
  exam_board: string | null;
  created_at: string;
  marking_mode: string;
  submissions: Array<{
    id: string;
    submitted_at: string;
    mark: number | null;
    grade: string | null;
    tutor_feedback: string | null;
    auto_mark: number | null;
    auto_grade: string | null;
    auto_feedback: string | null;
    auto_graded_at: string | null;
    auto_result: Record<string, unknown> | null;
    auto_confidence: number | null;
    ocr_processing: boolean | null;
  }>;
};

export async function requireStudentSession() {
  const session = await getStudentSessionFromCookies();
  if (!session) {
    redirect("/login");
  }
  return session;
}

export async function getStudentProfile() {
  const session = await requireStudentSession();
  const supabase = createSupabaseAdminClient();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id,full_name,email,year_group,role")
    .eq("id", session.studentId)
    .single();

  if (error || !profile || profile.role !== "student") {
    redirect("/login");
  }

  return profile;
}

export async function getStudentAssignments() {
  const session = await requireStudentSession();
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("assignments")
    .select(`
      id,
      title,
      subject,
      description,
      due_date,
      status,
      year_group,
      exam_board,
      created_at,
      marking_mode,
      submissions (
        id,
        submitted_at,
        mark,
        grade,
        tutor_feedback,
        auto_mark,
        auto_grade,
        auto_feedback,
        auto_graded_at,
        auto_result,
        auto_confidence,
        ocr_processing
      )
    `)
    .eq("student_id", session.studentId)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as AssignmentRow[];
}

export async function getStudentDashboardData() {
  const [profile, assignments, latestReview] = await Promise.all([
    getStudentProfile(),
    getStudentAssignments(),
    getLatestStudentReview()
  ]);

  const currentAssignment =
    assignments.find((assignment) => assignment.status === "assigned") ??
    assignments.find((assignment) => assignment.status === "submitted") ??
    assignments[0] ??
    null;

  const recentSubmission = assignments
    .flatMap((assignment) =>
      (assignment.submissions ?? []).map((submission) => ({
        ...submission,
        assignment
      }))
    )
    .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())[0] ?? null;

  const markedSubmissions = assignments.flatMap((assignment) => assignment.submissions ?? []).filter((submission) => submission.auto_mark !== null);

  const averageScore = markedSubmissions.length
    ? Math.round(
        markedSubmissions.reduce((sum, submission) => sum + Number(submission.auto_mark || 0), 0) / markedSubmissions.length
      )
    : null;

  return {
    profile,
    currentAssignment,
    recentSubmission,
    latestReview,
    stats: [
      {
        label: "Assignments",
        value: String(assignments.length),
        helper: "total tasks in portal",
        tone: "blue"
      },
      {
        label: "Submitted",
        value: String(assignments.filter((assignment) => assignment.status !== "assigned").length),
        helper: "work uploaded so far",
        tone: "amber"
      },
      {
        label: "Average mark",
        value: averageScore === null ? "Not marked yet" : `${averageScore}%`,
        helper: averageScore === null ? "awaiting AI results" : "across marked submissions",
        tone: averageScore === null ? "amber" : "green"
      }
    ]
  };
}

export async function getStudentAssignmentById(assignmentId: string) {
  const session = await requireStudentSession();
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("assignments")
    .select(`
      id,
      title,
      subject,
      description,
      due_date,
      status,
      year_group,
      exam_board,
      created_at,
      marking_mode,
      resource_title,
      resource_url,
      file_path,
      file_url,
      unit_id,
      lesson_id,
      submissions (
        id,
        submitted_at,
        mark,
        grade,
        tutor_feedback,
        auto_mark,
        auto_grade,
        auto_feedback,
        auto_graded_at,
        auto_result,
        auto_confidence,
        ocr_processing
      ),
      curriculum_units:unit_id (
        id,
        unit_title,
        course
      ),
      curriculum_lessons:lesson_id (
        id,
        lesson_title
      )
    `)
    .eq("id", assignmentId)
    .eq("student_id", session.studentId)
    .single();

  if (error) {
    return null;
  }

  if (!data.file_url && data.file_path) {
    const signedUrl = await supabase.storage
      .from(ASSIGNMENT_FILES_BUCKET)
      .createSignedUrl(data.file_path, 60 * 10);

    if (!signedUrl.error) {
      data.file_url = signedUrl.data.signedUrl;
    }
  }

  return data;
}

export async function getStudentSubmissionById(submissionId: string) {
  const session = await requireStudentSession();
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("submissions")
    .select(`
      id,
      notes,
      submitted_at,
      mark,
      grade,
      graded_at,
      auto_mark,
      auto_grade,
      auto_feedback,
      auto_graded_at,
      auto_result,
      auto_confidence,
      ocr_processing,
      tutor_feedback,
      tutor_result,
      submission_files (
        id,
        file_path
      ),
      assignments!inner (
        id,
        title,
        subject,
        year_group,
        exam_board,
        status,
        description
      )
    `)
    .eq("id", submissionId)
    .eq("student_id", session.studentId)
    .single();

  if (error) {
    return null;
  }

  return data;
}

export async function getStudentProgressData() {
  const session = await requireStudentSession();
  const supabase = createSupabaseAdminClient();

  const [submissionsRes, masteryRes] = await Promise.all([
    supabase
      .from("submissions")
      .select("id,submitted_at,auto_mark,auto_grade,assignment_id")
      .eq("student_id", session.studentId)
      .not("auto_mark", "is", null)
      .order("submitted_at", { ascending: false })
      .limit(8),
    supabase
      .from("objective_mastery")
      .select(`
        student_id,
        rating,
        updated_at,
        curriculum_objectives!inner (
          objective_id,
          subject,
          objective_text
        )
      `)
      .eq("student_id", session.studentId)
      .order("updated_at", { ascending: false })
      .limit(10)
  ]);

  if (submissionsRes.error) throw new Error(submissionsRes.error.message);
  if (masteryRes.error) throw new Error(masteryRes.error.message);

  return {
    submissions: submissionsRes.data ?? [],
    mastery: masteryRes.data ?? []
  };
}

export async function getLatestStudentReview() {
  const session = await requireStudentSession();
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("student_progress_reviews")
    .select("id,period_label,predicted_grade,confidence_pct,doing_well,needs_help,action_plan,created_at")
    .eq("student_id", session.studentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
