import type { SupabaseClient } from "@supabase/supabase-js";

type ManagedStudent = {
  id: string;
  full_name: string | null;
  email: string | null;
  year_group: string | null;
  role: string | null;
};

export async function getTutorManagedStudent(
  supabase: SupabaseClient,
  tutorId: string,
  studentId: string
) {
  const { data: student, error: studentError } = await supabase
    .from("profiles")
    .select("id,full_name,email,year_group,role")
    .eq("id", studentId)
    .maybeSingle();

  if (studentError) {
    throw new Error(studentError.message);
  }

  if (!student || student.role !== "student") {
    return null;
  }

  const [assignmentsRes, reviewsRes, accessCodesRes] = await Promise.all([
    supabase
      .from("assignments")
      .select("id", { count: "exact", head: true })
      .eq("student_id", studentId)
      .eq("tutor_id", tutorId),
    supabase
      .from("student_progress_reviews")
      .select("id", { count: "exact", head: true })
      .eq("student_id", studentId)
      .eq("tutor_id", tutorId),
    supabase
      .from("student_access_codes")
      .select("id", { count: "exact", head: true })
      .eq("student_id", studentId)
      .eq("created_by", tutorId)
  ]);

  if (assignmentsRes.error) {
    throw new Error(assignmentsRes.error.message);
  }
  if (reviewsRes.error) {
    throw new Error(reviewsRes.error.message);
  }
  if (accessCodesRes.error) {
    throw new Error(accessCodesRes.error.message);
  }

  const canManage = [assignmentsRes.count, reviewsRes.count, accessCodesRes.count].some(
    (count) => (count || 0) > 0
  );

  if (!canManage) {
    return null;
  }

  return student as ManagedStudent;
}
