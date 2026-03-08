import { requireSupabaseRole } from "@/lib/server/account-session";

type TutorStudent = {
  id: string;
  full_name: string | null;
  email: string | null;
  year_group: string | null;
};

type TutorParent = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type TutorSubmission = {
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

type TutorAssignment = {
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
  student: TutorStudent | TutorStudent[] | null;
  submissions: TutorSubmission[];
};

type TutorReview = {
  id: string;
  student_id: string;
  period_label: string | null;
  predicted_grade: string;
  confidence_pct: number | null;
  doing_well: string | null;
  needs_help: string | null;
  action_plan: string | null;
  created_at: string;
  student: TutorStudent | TutorStudent[] | null;
};

type TutorParentLink = {
  id: string;
  student_id: string;
  created_at: string;
  student: TutorStudent | TutorStudent[] | null;
  parent: TutorParent | TutorParent[] | null;
};

type TutorAccessCode = {
  id: string;
  student_id: string;
  access_code: string;
  is_active: boolean;
  expires_at: string | null;
  last_used_at: string | null;
  created_at: string;
  created_by: string | null;
  student: TutorStudent | TutorStudent[] | null;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

export function labelTutorStudent(student: TutorStudent | null | undefined) {
  if (!student) {
    return "Student";
  }
  return student.full_name || student.email || "Student";
}

export function labelTutorParent(parent: TutorParent | null | undefined) {
  if (!parent) {
    return "No linked parent";
  }
  return parent.full_name || parent.email || "Linked parent";
}

export function getTutorSubmissionScore(submission: TutorSubmission) {
  if (submission.mark !== null && submission.mark !== undefined) {
    return Number(submission.mark);
  }
  if (submission.auto_mark !== null && submission.auto_mark !== undefined) {
    return Number(submission.auto_mark);
  }
  return null;
}

export function getTutorSubmissionSummary(submission: TutorSubmission) {
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
  return "No feedback has been generated yet.";
}

export function normalizeTutorAssignment(assignment: TutorAssignment) {
  return {
    ...assignment,
    student: one(assignment.student),
    submissions: assignment.submissions ?? []
  };
}

export function normalizeTutorReview(review: TutorReview) {
  return {
    ...review,
    student: one(review.student)
  };
}

export function normalizeTutorParentLink(link: TutorParentLink) {
  return {
    ...link,
    student: one(link.student),
    parent: one(link.parent)
  };
}

export function normalizeTutorAccessCode(accessCode: TutorAccessCode) {
  return {
    ...accessCode,
    student: one(accessCode.student)
  };
}

type TutorDataOptions = {
  assignments?: boolean;
  reviews?: boolean;
  parentLinks?: boolean;
  accessCodes?: boolean;
};

export async function getTutorDataBundle(options: TutorDataOptions = {}) {
  const { supabase, profile } = await requireSupabaseRole("tutor");

  const assignmentsPromise = options.assignments
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
        .eq("tutor_id", profile.id)
        .order("created_at", { ascending: false })
    : Promise.resolve({ data: [], error: null });

  const reviewsPromise = options.reviews
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
        .eq("tutor_id", profile.id)
        .order("created_at", { ascending: false })
    : Promise.resolve({ data: [], error: null });

  const [assignmentsRes, reviewsRes] = await Promise.all([assignmentsPromise, reviewsPromise]);

  if (assignmentsRes.error) {
    throw new Error(assignmentsRes.error.message);
  }
  if (reviewsRes.error) {
    throw new Error(reviewsRes.error.message);
  }

  const assignments = (assignmentsRes.data ?? []).map((assignment) =>
    normalizeTutorAssignment(assignment as TutorAssignment)
  );
  const reviews = (reviewsRes.data ?? []).map((review) => normalizeTutorReview(review as TutorReview));

  const studentIds = [...new Set([
    ...assignments.map((assignment) => assignment.student_id),
    ...reviews.map((review) => review.student_id)
  ])];

  const parentLinksRes = options.parentLinks && studentIds.length
      ? await supabase
        .from("parent_student_links")
        .select(`
          id,
          student_id,
          created_at,
          student:profiles!parent_student_links_student_id_fkey (
            id,
            full_name,
            email,
            year_group
          ),
          parent:profiles!parent_student_links_parent_id_fkey (
            id,
            full_name,
            email
          )
        `)
        .in("student_id", studentIds)
    : { data: [], error: null };

  if (parentLinksRes.error) {
    throw new Error(parentLinksRes.error.message);
  }

  const accessCodeSelect = `
    id,
    student_id,
    access_code,
    is_active,
    expires_at,
    last_used_at,
    created_at,
    created_by,
    student:profiles!student_access_codes_student_id_fkey (
      id,
      full_name,
      email,
      year_group
    )
  `;

  const accessCodesByLinkedRes = options.accessCodes && studentIds.length
    ? await supabase
        .from("student_access_codes")
        .select(accessCodeSelect)
        .in("student_id", studentIds)
        .order("created_at", { ascending: false })
    : { data: [], error: null };

  const accessCodesByCreatorRes = options.accessCodes
    ? await supabase
        .from("student_access_codes")
        .select(accessCodeSelect)
        .eq("created_by", profile.id)
        .order("created_at", { ascending: false })
    : { data: [], error: null };

  if (accessCodesByLinkedRes.error) {
    throw new Error(accessCodesByLinkedRes.error.message);
  }
  if (accessCodesByCreatorRes.error) {
    throw new Error(accessCodesByCreatorRes.error.message);
  }

  const accessCodes = [
    ...((accessCodesByLinkedRes.data ?? []) as TutorAccessCode[]),
    ...((accessCodesByCreatorRes.data ?? []) as TutorAccessCode[])
  ].reduce<TutorAccessCode[]>((all, current) => {
    if (all.some((item) => item.id === current.id)) {
      return all;
    }
    all.push(current);
    return all;
  }, []);

  return {
    profile,
    assignments,
    reviews,
    parentLinks: (parentLinksRes.data ?? []).map((link) => normalizeTutorParentLink(link as TutorParentLink)),
    accessCodes: accessCodes.map((code) => normalizeTutorAccessCode(code))
  };
}
