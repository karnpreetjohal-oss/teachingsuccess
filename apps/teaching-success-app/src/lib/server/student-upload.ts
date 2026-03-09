import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getDefaultMarkingMode } from "@/lib/tutor-helpers";

const SUBMISSION_FILES_BUCKET = "submission-files";
const MAX_SUBMISSION_PHOTOS = 6;

type QuickUploadInput = {
  subject: string;
  topic: string;
  title?: string;
  notes?: string;
  markingMode?: string;
};

function inferExtension(file: File) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".png")) return "png";
  if (name.endsWith(".webp")) return "webp";
  if (name.endsWith(".heic")) return "heic";
  return "jpg";
}

export async function resolveTutorForQuickUpload(supabase: SupabaseClient, studentId: string) {
  const [latestAssignment, latestReview, latestAccessCode] = await Promise.all([
    supabase
      .from("assignments")
      .select("tutor_id,created_at")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("student_progress_reviews")
      .select("tutor_id,created_at")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("student_access_codes")
      .select("created_by,created_at")
      .eq("student_id", studentId)
      .not("created_by", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  if (latestAssignment.error) throw latestAssignment.error;
  if (latestReview.error) throw latestReview.error;
  if (latestAccessCode.error) throw latestAccessCode.error;

  const candidates = [
    latestAssignment.data?.tutor_id
      ? {
          tutorId: latestAssignment.data.tutor_id,
          createdAt: latestAssignment.data.created_at || null
        }
      : null,
    latestReview.data?.tutor_id
      ? {
          tutorId: latestReview.data.tutor_id,
          createdAt: latestReview.data.created_at || null
        }
      : null,
    latestAccessCode.data?.created_by
      ? {
          tutorId: latestAccessCode.data.created_by,
          createdAt: latestAccessCode.data.created_at || null
        }
      : null
  ]
    .filter((candidate): candidate is { tutorId: string; createdAt: string | null } => Boolean(candidate))
    .sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });

  return candidates[0]?.tutorId ?? null;
}

async function getStudentYearGroup(supabase: SupabaseClient, studentId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("year_group")
    .eq("id", studentId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.year_group ?? null;
}

export async function ensureSubmission(
  supabase: SupabaseClient,
  assignmentId: string,
  studentId: string,
  notes?: string
) {
  const existing = await supabase
    .from("submissions")
    .select("id,notes")
    .eq("assignment_id", assignmentId)
    .eq("student_id", studentId)
    .maybeSingle();

  if (existing.error) throw existing.error;

  if (existing.data?.id) {
    if (notes && notes !== existing.data.notes) {
      const { error } = await supabase
        .from("submissions")
        .update({ notes })
        .eq("id", existing.data.id);
      if (error) throw error;
    }
    return existing.data.id;
  }

  const { data, error } = await supabase
    .from("submissions")
    .insert({
      assignment_id: assignmentId,
      student_id: studentId,
      notes: notes || null,
      submitted_at: new Date().toISOString()
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

export async function createQuickUploadAssignment(
  supabase: SupabaseClient,
  studentId: string,
  input: QuickUploadInput
) {
  const tutorId = await resolveTutorForQuickUpload(supabase, studentId);
  if (!tutorId) {
    throw new Error("No tutor link found yet. Ask your tutor to assign one task first, then quick upload will work.");
  }

  const now = new Date();
  const dateLabel = now.toLocaleDateString("en-GB");
  const subject = input.subject?.trim() || "General";
  const topic = input.topic?.trim() || "";
  const studentYearGroup = await getStudentYearGroup(supabase, studentId);

  const title = input.title?.trim()
    ? `Quick Upload: ${input.title.trim()}`
    : topic
      ? `Quick Upload: ${subject} - ${topic} (${dateLabel})`
      : `Quick Upload: Awaiting detection (${dateLabel})`;

  const description = [
    topic ? `Quick upload topic: ${topic}` : "Quick upload awaiting OCR detection.",
    input.subject?.trim() ? `Student supplied subject: ${input.subject.trim()}` : "",
    input.title?.trim() ? `Student supplied title: ${input.title.trim()}` : "",
    input.notes?.trim() ? `Student note: ${input.notes.trim()}` : ""
  ]
    .filter(Boolean)
    .join("\n");

  const { data, error } = await supabase
    .from("assignments")
    .insert({
      tutor_id: tutorId,
      student_id: studentId,
      subject,
      title,
      description: description || null,
      status: "submitted",
      due_date: null,
      marking_mode: input.markingMode || getDefaultMarkingMode(subject, studentYearGroup),
      automark_enabled: true
    })
    .select("id,title")
    .single();

  if (error) throw error;
  return data;
}

export async function storeSubmissionFiles(
  supabase: SupabaseClient,
  studentId: string,
  assignmentId: string,
  submissionId: string,
  files: File[]
) {
  if (!files.length) {
    throw new Error("Please add at least one photo.");
  }
  if (files.length > MAX_SUBMISSION_PHOTOS) {
    throw new Error(`You can upload up to ${MAX_SUBMISSION_PHOTOS} photos at once.`);
  }

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const bytes = new Uint8Array(await file.arrayBuffer());
    const ext = inferExtension(file);
    const path = `${studentId}/${assignmentId}/${submissionId}/${Date.now()}-${index}-${randomUUID()}.${ext}`;

    const upload = await supabase.storage
      .from(SUBMISSION_FILES_BUCKET)
      .upload(path, bytes, {
        contentType: file.type || "image/jpeg",
        upsert: false,
        cacheControl: "3600"
      });

    if (upload.error) throw upload.error;

    const rowInsert = await supabase.from("submission_files").insert({
      submission_id: submissionId,
      assignment_id: assignmentId,
      student_id: studentId,
      file_path: path
    });

    if (rowInsert.error) throw rowInsert.error;
  }
}

export async function markAssignmentSubmitted(supabase: SupabaseClient, assignmentId: string, studentId: string) {
  const { error } = await supabase
    .from("assignments")
    .update({ status: "submitted" })
    .eq("id", assignmentId)
    .eq("student_id", studentId);

  if (error) throw error;
}

export async function triggerSubmissionOcr(supabase: SupabaseClient, submissionId: string) {
  const { data, error } = await supabase.functions.invoke("ocr_mark_submission", {
    body: { submission_id: submissionId }
  });

  if (error) {
    throw new Error(error.message || "Unable to trigger OCR marking.");
  }

  return data;
}
