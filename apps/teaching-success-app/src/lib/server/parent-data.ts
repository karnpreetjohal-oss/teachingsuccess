import { requireSupabaseRole, type AppProfile } from "@/lib/server/account-session";

type LinkedStudent = {
  id: string;
  full_name: string | null;
  email: string | null;
  year_group: string | null;
};

type ParentSubmission = {
  id: string;
  notes: string | null;
  submitted_at: string;
  mark: number | null;
  grade: string | null;
  tutor_feedback: string | null;
  graded_at: string | null;
  auto_mark: number | null;
  auto_grade: string | null;
  auto_feedback: string | null;
  auto_graded_at: string | null;
  ocr_processing: boolean | null;
  auto_result: Record<string, unknown> | null;
  auto_confidence: number | null;
};

type ParentAssignment = {
  id: string;
  student_id: string;
  subject: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: string;
  created_at: string;
  year_group: number | null;
  exam_board: string | null;
  marking_mode: string | null;
  student: LinkedStudent | LinkedStudent[] | null;
  submissions: ParentSubmission[];
};

type ParentReview = {
  id: string;
  student_id: string;
  period_label: string | null;
  predicted_grade: string;
  confidence_pct: number | null;
  doing_well: string | null;
  needs_help: string | null;
  action_plan: string | null;
  created_at: string;
  student: LinkedStudent | LinkedStudent[] | null;
};

type ParentMastery = {
  student_id: string;
  rating: string;
  updated_at: string;
  curriculum_objectives:
    | {
        objective_id: string;
        subject: string;
        objective_text: string;
      }
    | Array<{
        objective_id: string;
        subject: string;
        objective_text: string;
      }>
    | null;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

export function labelStudent(student: LinkedStudent | null | undefined) {
  if (!student) {
    return "Linked student";
  }
  return student.full_name || student.email || "Linked student";
}

export function getSubmissionScore(submission: ParentSubmission) {
  if (submission.mark !== null && submission.mark !== undefined) {
    return Number(submission.mark);
  }
  if (submission.auto_mark !== null && submission.auto_mark !== undefined) {
    return Number(submission.auto_mark);
  }
  return null;
}

export function getSubmissionSummary(submission: ParentSubmission) {
  if (submission.tutor_feedback) {
    return submission.tutor_feedback;
  }
  if (submission.auto_feedback) {
    return submission.auto_feedback;
  }
  const autoResult =
    submission.auto_result && typeof submission.auto_result === "object"
      ? (submission.auto_result as Record<string, unknown>)
      : {};
  if (typeof autoResult.summary === "string" && autoResult.summary.trim()) {
    return autoResult.summary;
  }
  return "Feedback has not been published yet.";
}

export function getSubmissionDetails(submission: ParentSubmission) {
  const autoResult =
    submission.auto_result && typeof submission.auto_result === "object"
      ? (submission.auto_result as Record<string, unknown>)
      : {};
  if (!Array.isArray(autoResult.details)) {
    return [];
  }
  return autoResult.details.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

export function getSubmissionNextSteps(submission: ParentSubmission) {
  const autoResult =
    submission.auto_result && typeof submission.auto_result === "object"
      ? (submission.auto_result as Record<string, unknown>)
      : {};
  const modeSpecific =
    autoResult.mode_specific && typeof autoResult.mode_specific === "object"
      ? (autoResult.mode_specific as Record<string, unknown>)
      : {};
  if (!Array.isArray(modeSpecific.next_steps)) {
    return [];
  }
  return modeSpecific.next_steps.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

export function normalizeParentAssignment(assignment: ParentAssignment) {
  return {
    ...assignment,
    student: one(assignment.student),
    submissions: assignment.submissions ?? []
  };
}

export function normalizeParentReview(review: ParentReview) {
  return {
    ...review,
    student: one(review.student)
  };
}

export function normalizeParentMastery(mastery: ParentMastery) {
  return {
    ...mastery,
    curriculum_objective: one(mastery.curriculum_objectives)
  };
}

type ParentDataOptions = {
  assignments?: boolean;
  reviews?: boolean;
  mastery?: boolean;
};

export async function getParentDataBundle(options: ParentDataOptions = {}) {
  const { supabase, profile } = await requireSupabaseRole("parent");

  const { data: links, error: linksError } = await supabase
    .from("parent_student_links")
    .select(`
      student_id,
      student:profiles!parent_student_links_student_id_fkey (
        id,
        full_name,
        email,
        year_group
      )
    `)
    .eq("parent_id", profile.id);

  if (linksError) {
    throw new Error(linksError.message);
  }

  const linkedStudents = (links ?? [])
    .map((link) => one(link.student))
    .filter((student): student is LinkedStudent => Boolean(student?.id));

  const studentIds = linkedStudents.map((student) => student.id);

  const assignmentsPromise = options.assignments && studentIds.length
    ? supabase
        .from("assignments")
        .select(`
          id,
          student_id,
          subject,
          title,
          description,
          due_date,
          status,
          created_at,
          year_group,
          exam_board,
          marking_mode,
          student:profiles!assignments_student_id_fkey (
            id,
            full_name,
            email,
            year_group
          ),
          submissions (
            id,
            notes,
            submitted_at,
            mark,
            grade,
            tutor_feedback,
            graded_at,
            auto_mark,
            auto_grade,
            auto_feedback,
            auto_graded_at,
            ocr_processing,
            auto_result,
            auto_confidence
          )
        `)
        .in("student_id", studentIds)
        .order("created_at", { ascending: false })
    : Promise.resolve({ data: [], error: null });

  const reviewsPromise = options.reviews && studentIds.length
    ? supabase
        .from("student_progress_reviews")
        .select(`
          id,
          student_id,
          period_label,
          predicted_grade,
          confidence_pct,
          doing_well,
          needs_help,
          action_plan,
          created_at,
          student:profiles!student_progress_reviews_student_id_fkey (
            id,
            full_name,
            email,
            year_group
          )
        `)
        .in("student_id", studentIds)
        .order("created_at", { ascending: false })
    : Promise.resolve({ data: [], error: null });

  const masteryPromise = options.mastery && studentIds.length
    ? supabase
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
        .in("student_id", studentIds)
        .order("updated_at", { ascending: false })
        .limit(40)
    : Promise.resolve({ data: [], error: null });

  const [assignmentsRes, reviewsRes, masteryRes] = await Promise.all([
    assignmentsPromise,
    reviewsPromise,
    masteryPromise
  ]);

  if (assignmentsRes.error) {
    throw new Error(assignmentsRes.error.message);
  }
  if (reviewsRes.error) {
    throw new Error(reviewsRes.error.message);
  }
  if (masteryRes.error) {
    throw new Error(masteryRes.error.message);
  }

  return {
    profile: profile as AppProfile,
    linkedStudents,
    assignments: (assignmentsRes.data ?? []).map((assignment) =>
      normalizeParentAssignment(assignment as ParentAssignment)
    ),
    reviews: (reviewsRes.data ?? []).map((review) => normalizeParentReview(review as ParentReview)),
    mastery: (masteryRes.data ?? []).map((entry) => normalizeParentMastery(entry as ParentMastery))
  };
}
